/* ============================================
   reports.js — Reports & Analytics (Phase 4)
   Everything computed client-side from IndexedDB —
   no server, works fully offline.
   ============================================ */

renderShell('reports.html', 'Reports');

let bills = [], expenses = [], customers = [], products = [], stockTx = [], staff = [], attendance = [];

function setRange(kind) {
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  if (kind === 'today') {
    document.getElementById('fromDate').value = toStr;
    document.getElementById('toDate').value = toStr;
  } else if (kind === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('fromDate').value = first;
    document.getElementById('toDate').value = toStr;
  }
  loadReports();
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

async function loadReports() {
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  if (!from || !to) return;

  [bills, expenses, customers, products, stockTx, staff, attendance] = await Promise.all([
    DB.getAll('bills'), DB.getAll('expenses'), DB.getAll('customers'),
    DB.getAll('products'), DB.getAll('stockTransactions'), DB.getAll('staff'), DB.getAll('attendance'),
  ]);

  const billsInRange = bills.filter(b => inRange(b.createdAt, from, to));
  const expensesInRange = expenses.filter(e => inRange(e.date, from, to));
  const consumptionInRange = stockTx.filter(t => t.type === 'consumption' && inRange(t.createdAt, from, to));

  const salesTotal = billsInRange.reduce((s, b) => s + (b.total || 0), 0);
  const expenseTotal = expensesInRange.reduce((s, e) => s + (e.amount || 0), 0);
  const productCostTotal = consumptionInRange.reduce((s, t) => {
    const p = products.find(pr => pr.id === t.productId);
    return s + (p ? (p.purchaseCost || 0) * t.qty : 0);
  }, 0);
  const profit = salesTotal - expenseTotal - productCostTotal;

  document.getElementById('statSales').textContent = fmtCurrency(salesTotal);
  document.getElementById('statExpenses').textContent = fmtCurrency(expenseTotal);
  document.getElementById('statProductCost').textContent = fmtCurrency(productCostTotal);
  document.getElementById('statProfit').textContent = fmtCurrency(profit);

  // Customer analytics
  const custIdsInRange = [...new Set(billsInRange.map(b => b.customerId))];
  let newCount = 0, repeatCount = 0;
  const spendByCustomer = {};
  custIdsInRange.forEach(id => {
    const hadEarlierBill = bills.some(b => b.customerId === id && b.createdAt.slice(0, 10) < from);
    if (hadEarlierBill) repeatCount++; else newCount++;
    spendByCustomer[id] = billsInRange.filter(b => b.customerId === id).reduce((s, b) => s + b.total, 0);
  });
  document.getElementById('statNewCust').textContent = newCount;
  document.getElementById('statRepeatCust').textContent = repeatCount;

  const topCust = Object.entries(spendByCustomer).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('topCustomers').innerHTML = topCust.length
    ? topCust.map(([id, amt]) => {
        const c = customers.find(cu => cu.id === id);
        return `<div class="list-row"><span>${c ? c.name : 'Unknown'}</span><strong>${fmtCurrency(amt)}</strong></div>`;
      }).join('')
    : '<div class="text-soft">No sales in this range.</div>';

  // Inventory
  const lowStock = products.filter(p => (p.currentStock || 0) <= (p.lowStockThreshold || 5));
  document.getElementById('statLowStock').textContent = lowStock.length;

  const consumedByProduct = {};
  consumptionInRange.forEach(t => { consumedByProduct[t.productId] = (consumedByProduct[t.productId] || 0) + t.qty; });
  const topProd = Object.entries(consumedByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('topProducts').innerHTML = topProd.length
    ? topProd.map(([id, qty]) => {
        const p = products.find(pr => pr.id === id);
        return `<div class="list-row"><span>${p ? p.name : 'Unknown'}</span><strong>${qty} ${p ? p.unit || '' : ''}</strong></div>`;
      }).join('')
    : '<div class="text-soft">No consumption recorded in this range.</div>';

  // Staff attendance
  const attInRange = attendance.filter(a => inRange(a.date, from, to));
  document.getElementById('staffAttendance').innerHTML = staff.length
    ? staff.map(s => {
        const present = attInRange.filter(a => a.staffId === s.id && a.status === 'Present').length;
        const absent = attInRange.filter(a => a.staffId === s.id && a.status === 'Absent').length;
        return `<div class="list-row"><span>${s.name}</span><span><span class="badge success">${present} present</span> <span class="badge warn">${absent} absent</span></span></div>`;
      }).join('')
    : '<div class="text-soft">No staff added yet.</div>';
}

/* ---------- CSV export ---------- */

function downloadCsv(filename, rows) {
  if (!rows.length) { alert('No data to export for this range.'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function currentRange() {
  return { from: document.getElementById('fromDate').value, to: document.getElementById('toDate').value };
}

function exportSales() {
  const { from, to } = currentRange();
  const rows = bills.filter(b => inRange(b.createdAt, from, to)).map(b => {
    const c = customers.find(cu => cu.id === b.customerId);
    return {
      Date: fmtDateTime(b.createdAt), Customer: c ? c.name : '', Items: (b.items || []).map(i => i.name).join('; '),
      Subtotal: b.subtotal, Discount: b.discount, PointsRedeemed: b.pointsRedeemed, Total: b.total, PaymentMode: b.paymentMode,
    };
  });
  downloadCsv(`sales-report_${from}_to_${to}.csv`, rows);
}

function exportExpenses() {
  const { from, to } = currentRange();
  const rows = expenses.filter(e => inRange(e.date, from, to)).map(e => ({
    Date: e.date, Category: e.category, Amount: e.amount, Notes: e.notes || '',
  }));
  downloadCsv(`expense-report_${from}_to_${to}.csv`, rows);
}

function exportCustomers() {
  const rows = customers.map(c => ({
    Name: c.name, Mobile: c.mobile, DOB: c.dob || '', Anniversary: c.anniversary || '',
    LoyaltyPoints: c.loyaltyPoints || 0, PreferredBeautician: c.preferredBeautician || '',
  }));
  downloadCsv('customer-report.csv', rows);
}

function exportInventory() {
  const rows = products.map(p => ({
    Name: p.name, Brand: p.brand || '', Category: p.category || '', Size: p.size || '', Unit: p.unit || '',
    CurrentStock: p.currentStock || 0, PurchaseCost: p.purchaseCost || 0, SellingCost: p.sellingCost || 0,
    LowStockThreshold: p.lowStockThreshold || 5,
  }));
  downloadCsv('inventory-report.csv', rows);
}

function exportStaff() {
  const { from, to } = currentRange();
  const attInRange = attendance.filter(a => inRange(a.date, from, to));
  const rows = staff.map(s => ({
    Name: s.name, Mobile: s.mobile || '', Salary: s.salary || 0, CommissionRate: s.commissionRate || 0,
    PresentDays: attInRange.filter(a => a.staffId === s.id && a.status === 'Present').length,
    AbsentDays: attInRange.filter(a => a.staffId === s.id && a.status === 'Absent').length,
  }));
  downloadCsv(`staff-report_${from}_to_${to}.csv`, rows);
}

setRange('month');
