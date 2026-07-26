/* ============================================
   inventory.js — Products, Purchases, Services
   (Phase 1)
   ============================================ */

renderShell('inventory.html', 'Inventory');

let allProducts = [];
let allServices = [];
let allPurchases = [];

function switchTab(tab) {
  ['products', 'purchase', 'services'].forEach((t) => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
    const btn = document.getElementById(`tabBtn-${t}`);
    btn.className = t === tab ? 'btn btn-secondary' : 'btn btn-ghost';
  });
  if (tab === 'purchase') {
    document.querySelectorAll('#purchaseRows .purRowProduct').forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = purchaseProductOptions();
      if (prev) sel.value = prev;
    });
    populatePurchaseProductSelect();
  }
}

/* ---------- Products ---------- */

async function loadProducts() {
  allProducts = await DB.getAll('products');
  renderProductList();
}

function renderProductList() {
  const el = document.getElementById('productList');
  if (!allProducts.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">▤</div>No products yet. Add your first one.</div>`;
    return;
  }
  el.innerHTML = allProducts
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => {
      const low = (p.currentStock || 0) <= (p.lowStockThreshold || 5);
      return `
      <div class="list-row" style="padding: 14px 18px; cursor:pointer;" onclick="openProductModal('${p.id}')">
        <div>
          <div style="font-weight:600;">${p.name} <span class="text-soft" style="font-weight:400;">${p.brand || ''}</span></div>
          <div class="text-soft" style="font-size:0.85rem;">${p.size || ''}${p.unit || ''} · ₹${p.sellingCost || 0}</div>
        </div>
        <span class="badge ${low ? 'warn' : 'success'}">${p.currentStock ?? 0} ${p.unit || ''}</span>
      </div>`;
    }).join('');
}

function openProductModal(id) {
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('prodId').value = '';
  document.querySelector('#productModal h2').textContent = 'New Product';
  if (id) {
    const p = allProducts.find(x => x.id === id);
    if (p) {
      document.getElementById('prodId').value = p.id;
      document.getElementById('prodName').value = p.name || '';
      document.getElementById('prodBrand').value = p.brand || '';
      document.getElementById('prodCategory').value = p.category || '';
      document.getElementById('prodSize').value = p.size || '';
      document.getElementById('prodUnit').value = p.unit || '';
      document.getElementById('prodPurchaseCost').value = p.purchaseCost || '';
      document.getElementById('prodSellingCost').value = p.sellingCost || '';
      document.getElementById('prodStock').value = p.currentStock || 0;
      document.getElementById('prodLowStock').value = p.lowStockThreshold || 5;
      document.querySelector('#productModal h2').textContent = 'Edit Product';
    }
  }
  document.getElementById('productModal').showModal();
}

document.getElementById('productForm').addEventListener('submit', async () => {
  const id = document.getElementById('prodId').value;
  const data = {
    name: document.getElementById('prodName').value.trim(),
    brand: document.getElementById('prodBrand').value.trim(),
    category: document.getElementById('prodCategory').value.trim(),
    size: document.getElementById('prodSize').value.trim(),
    unit: document.getElementById('prodUnit').value.trim(),
    purchaseCost: Number(document.getElementById('prodPurchaseCost').value) || 0,
    sellingCost: Number(document.getElementById('prodSellingCost').value) || 0,
    lowStockThreshold: Number(document.getElementById('prodLowStock').value) || 5,
  };
  if (id) {
    await DB.update('products', id, data);
  } else {
    data.currentStock = Number(document.getElementById('prodStock').value) || 0;
    await DB.add('products', data);
  }
  document.getElementById('productModal').close();
  await loadProducts();
});

/* ---------- Purchases (multiple products per invoice) ---------- */

function purchaseProductOptions() {
  return allProducts.map(p => `<option value="${p.id}">${p.name} (${p.currentStock ?? 0} ${p.unit || ''} in stock)</option>`).join('');
}

function addPurchaseRow() {
  const row = document.createElement('div');
  row.className = 'flex gap-8 mb-16 purchase-row';
  row.innerHTML = `
    <select class="purRowProduct" style="flex:1.4;">${purchaseProductOptions()}</select>
    <input class="purRowQty" type="number" min="0" step="any" placeholder="Qty added" style="max-width:110px;">
    <input class="purRowAmount" type="number" min="0" placeholder="Amount ₹" style="max-width:110px;">
    <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()">✕</button>
  `;
  document.getElementById('purchaseRows').appendChild(row);
}

function populatePurchaseProductSelect() {
  if (!document.getElementById('purchaseRows').children.length) addPurchaseRow();
}

async function recordPurchase() {
  const rows = Array.from(document.querySelectorAll('#purchaseRows .purchase-row'));
  const items = rows.map(row => ({
    productId: row.querySelector('.purRowProduct').value,
    qty: Number(row.querySelector('.purRowQty').value) || 0,
    amount: Number(row.querySelector('.purRowAmount').value) || 0,
  })).filter(i => i.productId && i.qty > 0);

  if (!items.length) return alert('Add at least one product with a quantity.');

  for (const item of items) {
    const product = await DB.get('products', item.productId);
    const newStock = (product.currentStock || 0) + item.qty;
    await DB.update('products', item.productId, { currentStock: newStock });
    await DB.add('stockTransactions', { productId: item.productId, type: 'purchase', qty: item.qty, note: 'Purchase entry' });
  }

  await DB.add('purchases', {
    supplier: document.getElementById('purSupplier').value.trim(),
    invoiceNo: document.getElementById('purInvoice').value.trim(),
    items,
    totalAmount: items.reduce((s, i) => s + i.amount, 0),
  });

  document.getElementById('purSupplier').value = '';
  document.getElementById('purInvoice').value = '';
  document.getElementById('purchaseRows').innerHTML = '';
  addPurchaseRow();

  await loadProducts();
  await loadPurchases();
}

async function loadPurchases() {
  allPurchases = await DB.getAll('purchases');
  const el = document.getElementById('purchaseList');
  if (!allPurchases.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📦</div>No purchases recorded yet.</div>`;
    return;
  }
  el.innerHTML = allPurchases
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 15)
    .map(pu => {
      const itemsText = (pu.items || []).map(i => {
        const prod = allProducts.find(p => p.id === i.productId);
        return `${prod ? prod.name : 'Unknown'} × ${i.qty}`;
      }).join(', ');
      return `<div class="list-row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:600;">${pu.supplier || 'Purchase'} ${pu.invoiceNo ? '· ' + pu.invoiceNo : ''}</div>
          <div class="text-soft" style="font-size:0.85rem;">${itemsText}</div>
        </div>
        <strong>${fmtCurrency(pu.totalAmount)}</strong>
      </div>`;
    }).join('');
}

/* ---------- Services ---------- */

async function loadServices() {
  allServices = await DB.getAll('services');
  const el = document.getElementById('serviceList');
  if (!allServices.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">✂</div>No services yet. Add your first one.</div>`;
    return;
  }
  el.innerHTML = allServices
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `
      <div class="list-row" style="padding:14px 18px; cursor:pointer;" onclick="openServiceModal('${s.id}')">
        <div>
          <div style="font-weight:600;">${s.name}</div>
          <div class="text-soft" style="font-size:0.85rem;">${s.durationMin || 0} min · ${(s.consumption || []).length} products used</div>
        </div>
        <strong>${fmtCurrency(s.price)}</strong>
      </div>`).join('');
}

function addConsumptionRow(productId = '', qty = '') {
  const row = document.createElement('div');
  row.className = 'flex gap-8 mb-16';
  row.innerHTML = `
    <select class="consProduct">${allProducts.map(p => `<option value="${p.id}" data-unit="${p.unit || ''}" ${p.id === productId ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
    <input class="consQty" type="number" min="0" step="any" placeholder="Qty used" value="${qty}" style="max-width:100px;">
    <span class="consUnit text-soft" style="min-width:36px; align-self:center; font-size:0.85rem;"></span>
    <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()">✕</button>
  `;
  const select = row.querySelector('.consProduct');
  const unitLabel = row.querySelector('.consUnit');
  const updateUnit = () => { unitLabel.textContent = select.selectedOptions[0]?.dataset.unit || ''; };
  select.addEventListener('change', updateUnit);
  updateUnit();
  document.getElementById('svcConsumptionRows').appendChild(row);
}

function openServiceModal(id) {
  const form = document.getElementById('serviceForm');
  form.reset();
  document.getElementById('svcId').value = '';
  document.getElementById('svcConsumptionRows').innerHTML = '';
  document.querySelector('#serviceModal h2').textContent = 'New Service';
  if (id) {
    const s = allServices.find(x => x.id === id);
    if (s) {
      document.getElementById('svcId').value = s.id;
      document.getElementById('svcName').value = s.name || '';
      document.getElementById('svcPrice').value = s.price || '';
      document.getElementById('svcDuration').value = s.durationMin || '';
      (s.consumption || []).forEach(c => addConsumptionRow(c.productId, c.qty));
      document.querySelector('#serviceModal h2').textContent = 'Edit Service';
    }
  }
  document.getElementById('serviceModal').showModal();
}

document.getElementById('serviceForm').addEventListener('submit', async () => {
  const id = document.getElementById('svcId').value;
  const consumption = Array.from(document.querySelectorAll('#svcConsumptionRows > div')).map(row => ({
    productId: row.querySelector('.consProduct').value,
    qty: Number(row.querySelector('.consQty').value) || 0,
  })).filter(c => c.productId && c.qty > 0);

  const data = {
    name: document.getElementById('svcName').value.trim(),
    price: Number(document.getElementById('svcPrice').value) || 0,
    durationMin: Number(document.getElementById('svcDuration').value) || 0,
    consumption,
  };
  if (id) {
    await DB.update('services', id, data);
  } else {
    await DB.add('services', data);
  }
  document.getElementById('serviceModal').close();
  await loadServices();
});

(async function init() {
  await loadProducts();
  await loadServices();
  await loadPurchases();
  populatePurchaseProductSelect();
})();
