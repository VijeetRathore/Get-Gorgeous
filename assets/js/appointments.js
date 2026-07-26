/* ============================================
   appointments.js — Appointment Management (Phase 2)
   ============================================ */

renderShell('appointments.html', 'Appointments');

const STATUS_FLOW = ['Booked', 'Arrived', 'Service Started', 'Completed'];
const STATUS_BADGE = {
  'Booked': 'badge',
  'Arrived': 'badge gold',
  'Service Started': 'badge warn',
  'Completed': 'badge success',
  'Cancelled': 'badge warn',
};

let customers = [];
let services = [];
let appointments = [];

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function init() {
  customers = await DB.getAll('customers');
  services = await DB.getAll('services');
  document.getElementById('apptCustomer').innerHTML =
    '<option value="">— Select customer —</option>' +
    customers.sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.id}">${c.name} (${c.mobile})</option>`).join('');
  document.getElementById('apptServices').innerHTML =
    services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  document.getElementById('dateFilter').value = todayStr();
  document.getElementById('dateFilter').addEventListener('change', loadAppointments);

  await loadAppointments();
}

async function loadAppointments() {
  appointments = await DB.getAll('appointments');
  const filterDate = document.getElementById('dateFilter').value;
  const filtered = filterDate
    ? appointments.filter(a => a.scheduledAt && a.scheduledAt.slice(0, 10) === filterDate)
    : appointments;

  const el = document.getElementById('apptList');
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">◷</div>No appointments for this day.</div>`;
    return;
  }

  el.innerHTML = filtered
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .map(a => {
      const cust = customers.find(c => c.id === a.customerId);
      const svcNames = (a.serviceIds || []).map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ');
      const time = a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      return `
      <div class="list-row" style="padding: 14px 18px; flex-wrap: wrap;">
        <div>
          <div style="font-weight:600;">${time} — ${cust ? cust.name : 'Unknown'}</div>
          <div class="text-soft" style="font-size:0.85rem;">${svcNames || 'No services selected'} ${a.beautician ? '· ' + a.beautician : ''}</div>
        </div>
        <div class="flex gap-8">
          <span class="${STATUS_BADGE[a.status] || 'badge'}">${a.status}</span>
          ${renderStatusActions(a)}
        </div>
      </div>`;
    }).join('');
}

function renderStatusActions(appt) {
  if (appt.status === 'Completed' || appt.status === 'Cancelled') {
    return `<button class="btn btn-ghost" onclick="editAppt('${appt.id}')">Edit</button>`;
  }
  const currentIdx = STATUS_FLOW.indexOf(appt.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1];
  return `
    ${nextStatus ? `<button class="btn btn-secondary" onclick="advanceStatus('${appt.id}', '${nextStatus}')">Mark ${nextStatus}</button>` : ''}
    <button class="btn btn-ghost" onclick="advanceStatus('${appt.id}', 'Cancelled')">Cancel</button>
  `;
}

async function advanceStatus(id, status) {
  await DB.update('appointments', id, { status });
  await loadAppointments();
}

function openApptModal() {
  document.getElementById('apptForm').reset();
  document.getElementById('apptId').value = '';
  document.querySelector('#apptModal h2').textContent = 'New Appointment';
  document.getElementById('apptModal').showModal();
}

window.editAppt = (id) => {
  const a = appointments.find(x => x.id === id);
  if (!a) return;
  document.getElementById('apptId').value = a.id;
  document.getElementById('apptCustomer').value = a.customerId || '';
  document.getElementById('apptBeautician').value = a.beautician || '';
  document.getElementById('apptDateTime').value = a.scheduledAt ? a.scheduledAt.slice(0, 16) : '';
  Array.from(document.getElementById('apptServices').options).forEach(opt => {
    opt.selected = (a.serviceIds || []).includes(opt.value);
  });
  document.querySelector('#apptModal h2').textContent = 'Edit Appointment';
  document.getElementById('apptModal').showModal();
};

document.getElementById('apptForm').addEventListener('submit', async () => {
  const id = document.getElementById('apptId').value;
  const serviceIds = Array.from(document.getElementById('apptServices').selectedOptions).map(o => o.value);
  const data = {
    customerId: document.getElementById('apptCustomer').value,
    beautician: document.getElementById('apptBeautician').value.trim(),
    scheduledAt: document.getElementById('apptDateTime').value,
    serviceIds,
  };
  if (id) {
    await DB.update('appointments', id, data);
  } else {
    await DB.add('appointments', { ...data, status: 'Booked' });
  }
  document.getElementById('apptModal').close();
  await loadAppointments();
});

init();
