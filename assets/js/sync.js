/* ============================================
   sync.js — push-only sync to Google Sheets/Drive
   Loaded on every page (after db.js + shell.js).
   Runs a background loop; also exposes Sync.now()
   for a manual "Sync Now" button on Settings.
   ============================================ */

const SYNCABLE_STORES = [
  'customers', 'appointments', 'services', 'bills', 'products',
  'purchases', 'stockTransactions', 'expenses', 'staff', 'attendance',
];

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let _syncing = false;

async function getSyncConfig() {
  const gasUrl = await DB.getSetting('gasUrl', '');
  const gasToken = await DB.getSetting('gasToken', '');
  return { gasUrl, gasToken, configured: !!(gasUrl && gasToken) };
}

async function pushStore(storeName, gasUrl, gasToken) {
  const unsynced = await DB.getUnsynced(storeName);
  if (!unsynced.length) return { store: storeName, synced: 0 };

  const res = await fetch(gasUrl, {
    method: 'POST',
    body: JSON.stringify({ token: gasToken, action: 'pushRecords', storeName, records: unsynced }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `Failed syncing ${storeName}`);

  for (const rec of unsynced) {
    await DB.markSynced(storeName, rec.id);
  }
  return { store: storeName, synced: unsynced.length };
}

async function pushPhotos(gasUrl, gasToken) {
  const unsynced = await DB.getUnsynced('photos');
  let count = 0;
  for (const photo of unsynced) {
    const res = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        token: gasToken, action: 'uploadPhoto',
        dataUrl: photo.localDataUrl, fileName: `${photo.customerId}_${photo.type}_${photo.id}.jpg`,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      await DB.markPhotoUploaded(photo.id, json.url);
      count++;
    }
  }
  return { store: 'photos', synced: count };
}

async function syncNow(onProgress) {
  if (_syncing) return { ok: false, error: 'Sync already in progress' };
  if (!navigator.onLine) return { ok: false, error: 'Offline — will retry when back online' };

  const { gasUrl, gasToken, configured } = await getSyncConfig();
  if (!configured) return { ok: false, error: 'Sync not set up yet — add your Apps Script URL + token in Settings' };

  _syncing = true;
  const results = [];
  try {
    for (const store of SYNCABLE_STORES) {
      const r = await pushStore(store, gasUrl, gasToken);
      results.push(r);
      if (onProgress) onProgress(r);
    }
    const photoResult = await pushPhotos(gasUrl, gasToken);
    results.push(photoResult);
    if (onProgress) onProgress(photoResult);

    await DB.setSetting('lastSyncedAt', new Date().toISOString());
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    _syncing = false;
  }
}

async function getPendingCount() {
  let total = 0;
  for (const store of [...SYNCABLE_STORES, 'photos']) {
    const unsynced = await DB.getUnsynced(store);
    total += unsynced.length;
  }
  return total;
}

async function restoreFromCloud() {
  const { gasUrl, gasToken, configured } = await getSyncConfig();
  if (!configured) return { ok: false, error: 'Sync not set up yet' };
  const res = await fetch(`${gasUrl}?action=pullAll&token=${encodeURIComponent(gasToken)}`);
  const json = await res.json();
  if (!json.ok) return { ok: false, error: json.error };

  for (const [storeName, records] of Object.entries(json.data)) {
    for (const record of records) {
      if (!record.id) continue;
      const existing = await DB.get(storeName, record.id);
      if (!existing) {
        await DB.add(storeName, { ...record, synced: true });
      }
    }
  }
  return { ok: true };
}

window.Sync = { now: syncNow, getPendingCount, restoreFromCloud, getSyncConfig };

/* ---------- Background loop ---------- */

let _syncTimer = null;
function startBackgroundSync() {
  if (_syncTimer) return;
  _syncTimer = setInterval(() => { syncNow(); }, SYNC_INTERVAL_MS);
  window.addEventListener('online', () => syncNow());
}
startBackgroundSync();

// Also refresh the topbar sync pill with pending count, if present
(async function refreshSyncPillWithPending() {
  const pill = document.getElementById('syncText');
  if (!pill) return;
  const pending = await getPendingCount();
  if (navigator.onLine && pending > 0) {
    pill.textContent = `Online — ${pending} pending`;
  } else if (navigator.onLine) {
    pill.textContent = 'Online — synced';
  }
})();
