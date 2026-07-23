/* ============================================
   shell.js — renders the sidebar nav + topbar
   on every page. Keeps nav markup in one place.
   ============================================ */

const NAV_ITEMS = [
  { href: 'dashboard.html',    icon: '⌂', label: 'Home' },
  { href: 'customers.html',    icon: '☺', label: 'Customers' },
  { href: 'billing.html',      icon: '₹', label: 'Billing' },
  { href: 'inventory.html',    icon: '▤', label: 'Stock' },
  { href: 'appointments.html', icon: '◷', label: 'Bookings' },
  { href: 'expenses.html',     icon: '⛁', label: 'Expenses' },
  { href: 'staff.html',        icon: '⚇', label: 'Staff' },
  { href: 'marketing.html',    icon: '✉', label: 'Marketing' },
  { href: 'reports.html',      icon: '◫', label: 'Reports' },
];

function renderShell(activeHref, pageTitle) {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';

  const navHtml = NAV_ITEMS.map((item) => `
    <a class="nav-item ${item.href === activeHref ? 'active' : ''}" href="${item.href}">
      <span class="icon">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">GG</div>
    ${navHtml}
  `;

  const topbar = document.getElementById('topbar');
  if (topbar) {
    topbar.innerHTML = `
      <div>
        <div class="eyebrow">Get Gorgeous</div>
        <h1>${pageTitle}</h1>
      </div>
      <span class="sync-pill" id="syncPill">
        <span class="dot"></span> <span id="syncText">Checking…</span>
      </span>
    `;
  }

  updateSyncPill();
  window.addEventListener('online', updateSyncPill);
  window.addEventListener('offline', updateSyncPill);
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
