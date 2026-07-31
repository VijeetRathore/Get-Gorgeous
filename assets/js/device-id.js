/* ============================================
   device-id.js — persistent device identity
   Loaded on every page (after db.js). Each phone
   gets a permanent random ID (localStorage, survives
   across sessions unlike sessionStorage) and registers
   itself in the shared `deviceTokens` store so Settings
   can designate which 1-2 devices are "master".
   ============================================ */

function getDeviceId() {
  let id = localStorage.getItem('gg_deviceId');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('gg_deviceId', id);
  }
  return id;
}

window.DEVICE_ID = getDeviceId();

async function registerDevice() {
  const existing = await DB.get('deviceTokens', window.DEVICE_ID);
  const now = new Date().toISOString();
  if (!existing) {
    await DB.add('deviceTokens', {
      deviceId: window.DEVICE_ID,
      label: `Device ${window.DEVICE_ID.slice(-4)}`,
      isMaster: false,
      fcmToken: null,
      lastSeenAt: now,
    });
    return;
  }
  // Only touch (and re-push) the record if the heartbeat is meaningfully stale —
  // avoids frequently re-pushing this device's own stale cached isMaster flag,
  // which could otherwise race with a Settings-side master-designation change
  // made on another device before this one has pulled the latest.
  const staleMs = Date.now() - new Date(existing.lastSeenAt || 0).getTime();
  if (staleMs > 5 * 60 * 1000) {
    await DB.update('deviceTokens', window.DEVICE_ID, { lastSeenAt: now });
  }
}
registerDevice();

/** True if THIS device is currently designated a master device.
 *  Bootstrap rule: if no device has been made master yet anywhere,
 *  every device is treated as allowed (so the very first person can
 *  reach Settings to designate the first master). Once at least one
 *  master exists, only master devices pass. */
async function isMasterDevice() {
  const all = await DB.getAll('deviceTokens');
  const anyMaster = all.some((d) => d.isMaster);
  if (!anyMaster) return true;
  const me = all.find((d) => d.deviceId === window.DEVICE_ID);
  return !!(me && me.isMaster);
}
