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
  if (tab === 'purchase') populatePurchaseProductSelect();
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
      document.getElementById('prodUnit').value = p.unit || 'ml';
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
    unit: document.getElementById('prodUnit').value,
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

/* ---------- Purchases ---------- */

function populatePurchaseProductSelect() {
  const sel = document.getElementById('purProduct');
  sel.innerHTML = allProducts.map(p => `<option value="${p.id}">${p.name} (${p.currentStock ?? 0} ${p.unit || ''} in stock)</option>`).join('');
}

async function recordPurchase() {
  const productId = document.getElementById('purProduct').value;
  const qty = Number(document.getElementById('purQty').value);
  const amount = Number(document.getElementById('purAmount').value) || 0;
  if (!productId || !qty) return alert('Select a product and enter quantity added.');

  const product = await DB.get('products', productId);
  const newStock = (product.currentStock || 0) + qty;
  await DB.update('products', productId, { currentStock: newStock });

  await DB.add('purchases', {
    supplier: document.getElementById('purSupplier').value.trim(),
    invoiceNo: document.getElementById('purInvoice').value.trim(),
    productId, qty, amount,
  });

  await DB.add('stockTransactions', { productId, type: 'purchase', qty, note: 'Purchase entry' });

  document.getElementById('purSupplier').value = '';
  document.getElementById('purInvoice').value = '';
  document.getElementById('purQty').value = '';
  document.getElementById('purAmount').value = '';

  await loadProducts();
  populatePurchaseProductSelect();
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
      const prod = allProducts.find(p => p.id === pu.productId);
      return `<div class="list-row">
        <span>${prod ? prod.name : '—'} <span class="text-soft">× ${pu.qty}</span></span>
        <span class="flex gap-8"><span class="text-soft">${pu.supplier || ''}</span><strong>${fmtCurrency(pu.amount)}</strong></span>
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
    <select class="consProduct">${allProducts.map(p => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
    <input class="consQty" type="number" min="0" step="any" placeholder="Qty used" value="${qty}" style="max-width:120px;">
    <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()">✕</button>
  `;
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
