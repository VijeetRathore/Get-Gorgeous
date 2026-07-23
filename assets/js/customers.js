/* ============================================
   customers.js — Customer CRM (Phase 1)
   ============================================ */

renderShell('customers.html', 'Customers');

const modal = document.getElementById('customerModal');
const form = document.getElementById('customerForm');
let allCustomers = [];

async function loadCustomers() {
  allCustomers = await DB.getAll('customers');
  renderCustomerList(allCustomers);
}

function renderCustomerList(list) {
  const el = document.getElementById('customerList');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">☺</div>No customers yet. Add your first one.</div>`;
    return;
  }
  el.innerHTML = list
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(c => `
      <div class="list-row" style="padding: 14px 18px; cursor: pointer;" onclick="window.location.href='customer-profile.html?id=${c.id}'">
        <div>
          <div style="font-weight:600;">${c.name}</div>
          <div class="text-soft" style="font-size:0.85rem;">${c.mobile}</div>
        </div>
        <span class="badge gold">${c.loyaltyPoints || 0} pts</span>
      </div>
    `).join('');
}

document.getElementById('searchBox').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderCustomerList(allCustomers);
  renderCustomerList(allCustomers.filter(c =>
    (c.name || '').toLowerCase().includes(q) || (c.mobile || '').includes(q)
  ));
});

document.getElementById('btnAddCustomer').addEventListener('click', () => {
  form.reset();
  document.getElementById('custId').value = '';
  document.querySelector('#customerModal h2').textContent = 'New Customer';
  modal.showModal();
});

document.getElementById('btnCancel').addEventListener('click', () => modal.close());

form.addEventListener('submit', async (e) => {
  const id = document.getElementById('custId').value;
  const data = {
    name: document.getElementById('custName').value.trim(),
    mobile: document.getElementById('custMobile').value.trim(),
    dob: document.getElementById('custDob').value,
    anniversary: document.getElementById('custAnniversary').value,
    address: document.getElementById('custAddress').value.trim(),
    skinType: document.getElementById('custSkinType').value,
    preferredBeautician: document.getElementById('custBeautician').value.trim(),
    notes: document.getElementById('custNotes').value.trim(),
  };

  if (id) {
    await DB.update('customers', id, data);
  } else {
    await DB.add('customers', { ...data, loyaltyPoints: 0 });
  }
  modal.close();
  loadCustomers();
});

loadCustomers();
