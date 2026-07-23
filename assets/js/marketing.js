/* ============================================
   marketing.js — Marketing Module (Phase 3)
   ============================================ */

renderShell('marketing.html', 'Marketing');

let customers = [];
let salonName = 'Get Gorgeous';

const TEMPLATES = {
  thankyou: (c) => `Hi ${c.name}, thank you for visiting ${salonName}! We hope you loved your service. See you again soon 💇`,
  loyalty: (c) => `Hi ${c.name}, you now have ${c.loyaltyPoints || 0} loyalty points with ${salonName} (worth ₹${c.loyaltyPoints || 0}). Redeem them on your next visit!`,
  review: (c) => `Hi ${c.name}, we'd love it if you could share your experience at ${salonName} with a quick Google review. It really helps us! 🙏`,
  birthday: (c) => `Happy Birthday ${c.name}! 🎉 Wishing you a beautiful year ahead — from all of us at ${salonName}.`,
  anniversary: (c) => `Happy Anniversary ${c.name}! 🎉 Wishing you both happiness always — from ${salonName}.`,
  reminder: (c) => `Hi ${c.name}, this is a reminder about your upcoming appointment at ${salonName}. See you soon!`,
};

async function init() {
  customers = await DB.getAll('customers');
  document.getElementById('mktCustomer').innerHTML =
    '<option value="">— Select customer —</option>' +
    customers.sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.id}">${c.name} (${c.mobile})</option>`).join('');

  salonName = await DB.getSetting('salonName', 'Get Gorgeous');

  document.getElementById('mktCustomer').addEventListener('change', updatePreview);
  document.getElementById('mktTemplate').addEventListener('change', updatePreview);
  document.getElementById('mktPreview').addEventListener('input', updateSendLink);

  await loadSocialLinks();
}

function updatePreview() {
  const custId = document.getElementById('mktCustomer').value;
  const customer = customers.find(c => c.id === custId);
  const templateKey = document.getElementById('mktTemplate').value;
  if (!customer) {
    document.getElementById('mktPreview').value = '';
    updateSendLink();
    return;
  }
  document.getElementById('mktPreview').value = TEMPLATES[templateKey](customer);
  updateSendLink();
}

function updateSendLink() {
  const custId = document.getElementById('mktCustomer').value;
  const customer = customers.find(c => c.id === custId);
  const text = document.getElementById('mktPreview').value;
  const btn = document.getElementById('mktSendBtn');
  if (!customer || !customer.mobile) {
    btn.href = '#';
    return;
  }
  const mobile = customer.mobile.replace(/\D/g, '');
  btn.href = `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`;
}

/* ---------- Social links ---------- */

async function loadSocialLinks() {
  document.getElementById('setReview').value = await DB.getSetting('reviewLink', '');
  document.getElementById('setInstagram').value = await DB.getSetting('instagramLink', '');
  document.getElementById('setFacebook').value = await DB.getSetting('facebookLink', '');
  document.getElementById('setMaps').value = await DB.getSetting('mapsLink', '');
  refreshQuickButtons();
}

async function saveSocialLinks() {
  await DB.setSetting('reviewLink', document.getElementById('setReview').value.trim());
  await DB.setSetting('instagramLink', document.getElementById('setInstagram').value.trim());
  await DB.setSetting('facebookLink', document.getElementById('setFacebook').value.trim());
  await DB.setSetting('mapsLink', document.getElementById('setMaps').value.trim());
  refreshQuickButtons();
  alert('Links saved.');
}

async function refreshQuickButtons() {
  document.getElementById('btnReview').href = await DB.getSetting('reviewLink', '#') || '#';
  document.getElementById('btnInsta').href = await DB.getSetting('instagramLink', '#') || '#';
  document.getElementById('btnFb').href = await DB.getSetting('facebookLink', '#') || '#';
  document.getElementById('btnMaps').href = await DB.getSetting('mapsLink', '#') || '#';
}

init();
