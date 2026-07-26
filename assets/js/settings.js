/* ============================================
   settings.js — Settings page (Phase 4 wrap-up)
   ============================================ */

renderShell('settings.html', 'Settings');

const BACKUP_STORES = [
  'customers', 'appointments', 'services', 'bills', 'products',
  'purchases', 'stockTransactions', 'expenses', 'photos', 'staff', 'attendance',
];

async function init() {
  const gasUrl = await DB.getSetting('gasUrl', '');
  const gasToken = await DB.getSetting('gasToken', '');
  document.getElementById('setGasUrl').value = gasUrl;
  document.getElementById('setGasToken').value = gasToken;

  await refreshSyncStatus();
  await refreshNotifStatus();

  document.getElementById('restoreFile').addEventListener('change', (e) => {
    if (e.target.files[0]) restoreFromFile(e.target.files[0]);
  });
}

async function refreshSyncStatus() {
  const { configured } = await Sync.getSyncConfig();
  document.getElementById('syncStatusText').textContent = configured ? 'Configured' : 'Not configured';

  const lastSynced = await DB.getSetting('lastSyncedAt', null);
  document.getElementById('lastSyncedText').textContent = lastSynced ? fmtDateTime(lastSynced) : 'Never';

  const pending = await Sync.getPendingCount();
  document.getElementById('pendingCount').textContent = pending;
}

async function saveSyncConfig() {
  await DB.setSetting('gasUrl', document.getElementById('setGasUrl').value.trim());
  await DB.setSetting('gasToken', document.getElementById('setGasToken').value.trim());
  await refreshSyncStatus();
  alert('Sync settings saved.');
}

async function runSyncNow() {
  const logEl = document.getElementById('syncLog');
  logEl.textContent = 'Syncing…';
  const result = await Sync.now((progress) => {
    logEl.textContent = `Synced ${progress.store}: ${progress.synced} record(s)…`;
  });
  if (result.ok) {
    logEl.textContent = `✓ Sync complete — ${result.results.reduce((s, r) => s + r.synced, 0)} records pushed.`;
  } else {
    logEl.textContent = `✗ ${result.error}`;
  }
  await refreshSyncStatus();
}

/* ---------- Notifications ---------- */

async function refreshNotifStatus() {
  const el = document.getElementById('notifStatus');
  if (typeof Notification === 'undefined') { el.textContent = 'Not supported on this device'; return; }
  el.textContent = Notification.permission === 'granted' ? 'Enabled'
    : Notification.permission === 'denied' ? 'Blocked (check browser settings)'
    : 'Not enabled';
}

async function enableReminders() {
  const result = await Reminders.requestPermission();
  await refreshNotifStatus();
  if (result === 'granted') alert('Reminders enabled — you\'ll get a notification ~30 min before each booking, while the app is open.');
}

/* ---------- Local backup ---------- */

async function exportBackup() {
  const data = {};
  for (const store of BACKUP_STORES) {
    data[store] = await DB.getAll(store);
  }
  data._exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `get-gorgeous-backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function restoreFromFile(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { return alert('Invalid backup file.'); }

  if (!confirm('This will add any records from the backup that are missing locally. Continue?')) return;

  let restoredCount = 0;
  for (const store of BACKUP_STORES) {
    const records = data[store] || [];
    for (const record of records) {
      if (!record.id) continue;
      const existing = await DB.get(store, record.id);
      if (!existing) {
        await DB.add(store, { ...record, synced: false });
        restoredCount++;
      }
    }
  }
  alert(`Restore complete — ${restoredCount} record(s) added.`);
}

async function restoreFromCloud() {
  if (!confirm('Pull all data from Google Sheets into this tablet? Existing local records will not be overwritten.')) return;
  const result = await Sync.restoreFromCloud();
  if (result.ok) alert('Restore from cloud complete.');
  else alert('Restore failed: ' + result.error);
}

/* ---------- PIN ---------- */

async function simpleHash(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function changePin() {
  const val = document.getElementById('newPin').value.trim();
  if (val.length < 4) return alert('PIN should be at least 4 digits.');
  await DB.setSetting('pinHash', await simpleHash(val));
  document.getElementById('newPin').value = '';
  alert('PIN updated.');
}

init();
