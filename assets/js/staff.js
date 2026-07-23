/* ============================================
   staff.js — Staff Management (Phase 3)
   Note: revenue-per-staff report needs billing to
   tag a beautician per line item — not wired yet,
   so this covers master data + attendance only.
   ============================================ */

renderShell('staff.html', 'Staff');

let allStaff = [];
const todayStr = new Date().toISOString().slice(0, 10);

function switchTab(tab) {
  ['list', 'attendance'].forEach((t) => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`tabBtn-${t}`).className = t === tab ? 'btn btn-secondary' : 'btn btn-ghost';
  });
  if (tab === 'attendance') loadAttendance();
}

async function loadStaff() {
  allStaff = await DB.getAll('staff');
  const el = document.getElementById('staffList');
  if (!allStaff.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">⚇</div>No staff added yet.</div>';
    return;
  }
  el.innerHTML = allStaff
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `
      <div class="list-row" style="padding:14px 18px; cursor:pointer;" onclick="openStaffModal('${s.id}')">
        <div>
          <div style="font-weight:600;">${s.name}</div>
          <div class="text-soft" style="font-size:0.85rem;">${s.mobile || ''} ${s.joiningDate ? '· joined ' + fmtDate(s.joiningDate) : ''}</div>
        </div>
        <span class="badge gold">${s.commissionRate || 0}% commission</span>
      </div>
    `).join('');
}

function openStaffModal(id) {
  document.getElementById('staffForm').reset();
  document.getElementById('stfId').value = '';
  document.querySelector('#staffModal h2').textContent = 'New Staff';
  if (id) {
    const s = allStaff.find(x => x.id === id);
    if (s) {
      document.getElementById('stfId').value = s.id;
      document.getElementById('stfName').value = s.name || '';
      document.getElementById('stfMobile').value = s.mobile || '';
      document.getElementById('stfJoining').value = s.joiningDate || '';
      document.getElementById('stfSalary').value = s.salary || '';
      document.getElementById('stfCommission').value = s.commissionRate || '';
      document.querySelector('#staffModal h2').textContent = 'Edit Staff';
    }
  }
  document.getElementById('staffModal').showModal();
}

document.getElementById('staffForm').addEventListener('submit', async () => {
  const id = document.getElementById('stfId').value;
  const data = {
    name: document.getElementById('stfName').value.trim(),
    mobile: document.getElementById('stfMobile').value.trim(),
    joiningDate: document.getElementById('stfJoining').value,
    salary: Number(document.getElementById('stfSalary').value) || 0,
    commissionRate: Number(document.getElementById('stfCommission').value) || 0,
  };
  if (id) {
    await DB.update('staff', id, data);
  } else {
    await DB.add('staff', data);
  }
  document.getElementById('staffModal').close();
  await loadStaff();
});

/* ---------- Attendance ---------- */

async function loadAttendance() {
  document.getElementById('attDateLabel').textContent = fmtDate(todayStr);
  const records = await DB.getByIndex('attendance', 'date', todayStr);
  const el = document.getElementById('attendanceList');

  if (!allStaff.length) {
    el.innerHTML = '<div class="empty-state text-soft">Add staff first.</div>';
    return;
  }

  el.innerHTML = allStaff.map(s => {
    const rec = records.find(r => r.staffId === s.id);
    const status = rec ? rec.status : null;
    return `
      <div class="list-row">
        <span>${s.name}</span>
        <div class="flex gap-8">
          <button class="btn ${status === 'Present' ? 'btn-primary' : 'btn-secondary'}" onclick="markAttendance('${s.id}', 'Present')">Present</button>
          <button class="btn ${status === 'Absent' ? 'btn-primary' : 'btn-secondary'}" onclick="markAttendance('${s.id}', 'Absent')">Absent</button>
        </div>
      </div>
    `;
  }).join('');
}

async function markAttendance(staffId, status) {
  const records = await DB.getByIndex('attendance', 'date', todayStr);
  const existing = records.find(r => r.staffId === staffId);
  if (existing) {
    await DB.update('attendance', existing.id, { status });
  } else {
    await DB.add('attendance', { staffId, date: todayStr, status });
  }
  await loadAttendance();
}

(async function init() {
  await loadStaff();
})();
