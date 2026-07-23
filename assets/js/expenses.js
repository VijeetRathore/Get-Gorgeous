/* ============================================
   expenses.js — Expense Management (Phase 3)
   ============================================ */

renderShell('expenses.html', 'Expenses');

document.getElementById('expDate').value = new Date().toISOString().slice(0, 10);

function resizeImageFile(file, maxWidth = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveExpense() {
  const category = document.getElementById('expCategory').value;
  const amount = Number(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const notes = document.getElementById('expNotes').value.trim();
  const file = document.getElementById('expPhoto').files[0];

  if (!amount || !date) return alert('Amount aur Date bharna zaroori hai.');

  let photoDataUrl = null;
  if (file) photoDataUrl = await resizeImageFile(file);

  await DB.add('expenses', { category, amount, date, notes, photoDataUrl });

  document.getElementById('expAmount').value = '';
  document.getElementById('expNotes').value = '';
  document.getElementById('expPhoto').value = '';

  await loadExpenses();
}

async function loadExpenses() {
  const expenses = await DB.getAll('expenses');
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthKey = todayStr.slice(0, 7);

  const todayTotal = expenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.amount, 0);
  const monthTotal = expenses.filter(e => (e.date || '').startsWith(monthKey)).reduce((s, e) => s + e.amount, 0);
  document.getElementById('statTodayTotal').textContent = fmtCurrency(todayTotal);
  document.getElementById('statMonthTotal').textContent = fmtCurrency(monthTotal);

  const el = document.getElementById('expenseList');
  if (!expenses.length) {
    el.innerHTML = '<div class="empty-state text-soft">No expenses recorded yet.</div>';
    return;
  }
  el.innerHTML = expenses
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(e => `
      <div class="list-row">
        <div>
          <span class="badge">${e.category}</span>
          <span class="text-soft" style="margin-left:8px; font-size:0.85rem;">${fmtDate(e.date)}</span>
          ${e.notes ? `<div class="text-soft" style="font-size:0.8rem;">${e.notes}</div>` : ''}
        </div>
        <strong>${fmtCurrency(e.amount)}</strong>
      </div>
    `).join('');
}

loadExpenses();
