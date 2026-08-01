/* ============================================
   sync.js — multi-device sync to Google Sheets/Drive
   - PUSH: fires ~1.5s after every save (debounced),
     plus a periodic safety-net sweep.
   - PULL: periodically fetches shared master data
     (customers, products, services, staff) so all
     phones stay reasonably in sync with each other.
   Loaded on every page (after db.js + shell.js).
   ============================================ */

const SYNCABLE_STORES = [
  'customers', 'appointments', 'services', 'bills', 'products',
  'purchases', 'stockTransactions', 'expenses', 'staff', 'attendance', 'pendingMessages', 'deviceTokens',
];

// Shared "master data" that other phones may have changed — pulled regularly.
// (Bills/appointments/expenses/etc. are each-phone-creates-its-own records,
// so they don't need frequent pulling — pushing them is enough.)
// pendingMessages + deviceTokens ARE pulled too — every phone/device needs to
// see the same queue and the current master-device designation.
const PULL_STORES = ['customers', 'products', 'services', 'staff', 'pendingMessages', 'deviceTokens'];

// Fields that get JSON-stringified on push (see Code.gs flattenRecord) and
// need parsing back into real arrays/objects when pulled from Sheets.
const JSON_FIELDS = {
  services: ['consumption'],
  bills: ['items'],
};

const PUSH_INTERVAL_MS = 30 * 1000;   // safety-net sweep, in case a debounced push got missed
const PULL_INTERVAL_MS = 45 * 1000;   // how often to check for other phones' changes
const PUSH_DEBOUNCE_MS = 1500;        // wait this long after the last save before pushing

let _syncing = false;
let _pulling = false;

async function getSyncConfig() {
  const gasUrl = GAS_URL;
  const gasToken = GAS_TOKEN;
  const configured = !!(gasUrl && gasToken && !gasUrl.startsWith('PASTE-') && !gasToken.startsWith('PASTE-'));
  return { gasUrl, gasToken, configured };
}

/* ---------- PUSH ---------- */

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

// Call this right after any save — debounced so a flurry of writes from one
// action (e.g. a bill touching stock + points + the bill itself) becomes one sync.
let _pushDebounceTimer = null;
function requestSync() {
  if (_pushDebounceTimer) clearTimeout(_pushDebounceTimer);
  _pushDebounceTimer = setTimeout(() => { syncNow(); }, PUSH_DEBOUNCE_MS);
}

/* ---------- PULL ---------- */

function parseJsonFields(storeName, record) {
  const fields = JSON_FIELDS[storeName];
  if (!fields) return record;
  const copy = { ...record };
  fields.forEach((f) => {
    if (typeof copy[f] === 'string' && copy[f].startsWith('[')) {
      try { copy[f] = JSON.parse(copy[f]); } catch { /* leave as-is */ }
    }
  });
  return copy;
}

async function pullLatest() {
  if (_pulling) return;
  const { gasUrl, gasToken, configured } = await getSyncConfig();
  if (!configured || !navigator.onLine) return;

  _pulling = true;
  try {
    const res = await fetch(`${gasUrl}?action=pullAll&token=${encodeURIComponent(gasToken)}`);
    const json = await res.json();
    if (!json.ok) return;

    for (const storeName of PULL_STORES) {
      const remoteRecords = json.data[storeName] || [];
      for (const remote of remoteRecords) {
        if (!remote.id) continue;
        const clean = parseJsonFields(storeName, remote);
        const local = await DB.get(storeName, remote.id);

        if (!local) {
          // New record from another phone — add it.
          await DB.overwriteFromRemote(storeName, remote.id, clean);
        } else if (local.synced !== false) {
          // Only overwrite if THIS phone has no unpushed local edits to it —
          // otherwise we'd clobber a change that hasn't synced yet.
          const remoteTime = new Date(remote.updatedAt || 0).getTime();
          const localTime = new Date(local.updatedAt || 0).getTime();
          if (remoteTime > localTime) {
            await DB.overwriteFromRemote(storeName, remote.id, clean);
          }
        }
      }
    }
  } catch (err) {
    // silent — will retry on the next interval
  } finally {
    _pulling = false;
  }
}

/* ---------- Shared helpers ---------- */

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
      const clean = parseJsonFields(storeName, record);
      const existing = await DB.get(storeName, record.id);
      if (!existing) {
        await DB.add(storeName, { ...clean, synced: true });
      }
    }
  }
  return { ok: true };
}

window.Sync = { now: syncNow, requestSync, pullLatest, getPendingCount, restoreFromCloud, getSyncConfig };

/* ---------- Background loops ---------- */

let _pushTimer = null;
let _pullTimer = null;
function startBackgroundSync() {
  if (_pushTimer) return;
  _pushTimer = setInterval(() => { syncNow(); }, PUSH_INTERVAL_MS);
  _pullTimer = setInterval(() => { pullLatest(); }, PULL_INTERVAL_MS);
  window.addEventListener('online', () => { syncNow(); pullLatest(); });
  pullLatest(); // pull fresh data as soon as the page opens, don't wait for the interval
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
