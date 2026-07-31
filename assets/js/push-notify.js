/* ============================================
   push-notify.js — FCM push registration
   Used from Settings, on a master device, to enable
   true push notifications (works even if the app/tab
   is closed) for new WhatsApp Queue items.
   ============================================ */

async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    alert('Push notifications is not supported on this browser/device.');
    return;
  }
  if (firebaseConfig.apiKey.startsWith('PASTE-')) {
    alert('Firebase abhi configure nahi hua — assets/js/firebase-config.js mein apni Firebase project ki values daalo pehle.');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission denied — browser/phone settings se allow karna hoga.');
    await refreshPushStatus();
    return;
  }

  try {
    const swReg = await navigator.serviceWorker.ready;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

    await DB.update('deviceTokens', window.DEVICE_ID, { fcmToken: token });
    Sync.requestSync();
    await refreshPushStatus();
    alert('Push notifications enabled is device ke liye ✅');
  } catch (err) {
    alert('Push enable karne mein error: ' + (err.message || err));
  }
}

async function refreshPushStatus() {
  const el = document.getElementById('pushStatus');
  if (!el) return;
  if (typeof Notification === 'undefined') { el.textContent = 'Not supported'; return; }
  if (Notification.permission === 'denied') { el.textContent = 'Blocked in browser settings'; return; }

  const me = await DB.get('deviceTokens', window.DEVICE_ID);
  el.textContent = (me && me.fcmToken) ? 'Enabled ✅' : 'Not enabled yet';
}
