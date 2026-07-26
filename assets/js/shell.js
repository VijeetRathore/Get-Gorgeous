/* ============================================
   shell.js — renders the top nav bar (Back/Home)
   on every inner page. home.html (the launcher
   grid) does NOT call this — it has its own markup.
   ============================================ */

function renderShell(activeHref, pageTitle) {
  const bar = document.getElementById('topNavBar');
  if (bar) {
    const canGoBack = window.history.length > 1 && document.referrer.includes(window.location.origin);
    bar.innerHTML = `
      <button class="top-nav-btn ${canGoBack ? '' : 'disabled'}" onclick="goBack()" aria-label="Back">←</button>
      <a class="top-nav-btn" href="home.html" aria-label="Home">⌂</a>
      <div class="top-nav-brand">GG</div>
      <strong style="font-size:0.95rem; flex:1;">${pageTitle}</strong>
      <span class="sync-pill" id="syncPill">
        <span class="dot"></span> <span id="syncText">…</span>
      </span>
    `;
  }

  updateSyncPill();
  window.addEventListener('online', updateSyncPill);
  window.addEventListener('offline', updateSyncPill);
}

function goBack() {
  if (window.history.length > 1 && document.referrer.includes(window.location.origin)) {
    window.history.back();
  } else {
    window.location.href = 'home.html';
  }
}

function updateSyncPill() {
  const pill = document.getElementById('syncPill');
  const text = document.getElementById('syncText');
  if (!pill || !text) return;
  if (navigator.onLine) {
    pill.classList.remove('offline');
    text.textContent = 'Online';
  } else {
    pill.classList.add('offline');
    text.textContent = 'Offline — saving locally';
  }
}

function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Builds a working wa.me link. WhatsApp requires the full country code with no
 *  leading + or 0 — a bare 10-digit Indian number will silently fail to open a chat.
 *  Assumes India (91) when the cleaned number is exactly 10 digits; leaves longer
 *  numbers (already has a country code) untouched. */
function buildWhatsAppLink(mobile, text) {
  let clean = String(mobile || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
