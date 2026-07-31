/* ============================================
   device-guard.js — master-device-only page lock
   Include on dashboard.html, reports.html, settings.html
   (after db.js + device-id.js, alongside pin-guard.js).
   Unlike pin-guard (a shared secret), this checks the
   PHYSICAL device's designation, synced from Settings.
   ============================================ */

(async function deviceGuard() {
  const allowed = await isMasterDevice();
  if (allowed) return;

  const overlay = document.createElement('div');
  overlay.id = 'deviceGuardOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--surface-sunken,#F7F1EE);display:flex;align-items:center;justify-content:center;font-family:var(--font-body,-apple-system,sans-serif);';
  overlay.innerHTML = `
    <div class="card" style="width:min(360px,90vw);text-align:center;">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--accent,#A6314F);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-display,serif);font-weight:700;font-size:1.5rem;margin:0 auto 16px;">GG</div>
      <h2 style="margin:0 0 12px;font-family:var(--font-display,serif);">Master Device Only</h2>
      <p class="text-soft" style="font-size:0.88rem;margin:0 0 16px;">Yeh section sirf owner-designated master device(s) se khulta hai. Agar yeh device master hona chahiye, Settings mein (kisi master device se) is device ki Device ID add karo.</p>
      <div class="text-soft" style="font-size:0.78rem;background:var(--surface-sunken);padding:8px;border-radius:8px;word-break:break-all;">Is device ki ID: ${window.DEVICE_ID}</div>
      <a href="home.html" class="btn btn-primary" style="width:100%;margin-top:16px;text-decoration:none;display:inline-flex;justify-content:center;">← Back to Home</a>
    </div>
  `;
  document.documentElement.appendChild(overlay);
})();
