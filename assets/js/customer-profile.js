/* ============================================
   customer-profile.js — Phase 2
   ============================================ */

renderShell(null, 'Customer Profile');

const params = new URLSearchParams(window.location.search);
const customerId = params.get('id');
let customer = null;
const editModal = document.getElementById('editModal');

async function loadProfile() {
  if (!customerId) {
    document.querySelector('.main').innerHTML = '<div class="empty-state">No customer selected.</div>';
    return;
  }
  customer = await DB.get('customers', customerId);
  if (!customer) {
    document.querySelector('.main').innerHTML = '<div class="empty-state">Customer not found.</div>';
    return;
  }

  document.getElementById('profName').textContent = customer.name;
  document.getElementById('profMobile').textContent = customer.mobile;
  document.getElementById('profDob').textContent = customer.dob ? fmtDate(customer.dob) : '—';
  document.getElementById('profAnniversary').textContent = customer.anniversary ? fmtDate(customer.anniversary) : '—';
  document.getElementById('profSkin').textContent = customer.skinType || '—';
  document.getElementById('profBeautician').textContent = customer.preferredBeautician || '—';
  if (customer.notes) {
    document.getElementById('profNotesWrap').style.display = 'block';
    document.getElementById('profNotes').textContent = customer.notes;
  }

  const points = customer.loyaltyPoints || 0;
  document.getElementById('loyaltyPoints').textContent = `${points} pts`;
  document.getElementById('loyaltyValue').textContent = points;

  await loadVisitHistory();
  await loadPhotos();
}

async function loadVisitHistory() {
  const bills = await DB.getByIndex('bills', 'customerId', customerId);
  const el = document.getElementById('visitHistory');
  if (!bills.length) {
    el.innerHTML = '<div class="empty-state text-soft">No visits yet.</div>';
    return;
  }
  el.innerHTML = bills
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(b => {
      const itemNames = (b.items || []).map(i => i.name).join(', ');
      return `
      <div class="list-row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:600;">${fmtDateTime(b.createdAt)}</div>
          <div class="text-soft" style="font-size:0.85rem;">${itemNames}</div>
          <div class="text-soft" style="font-size:0.78rem;">${b.paymentMode} ${b.pointsRedeemed ? `· redeemed ${b.pointsRedeemed} pts` : ''} ${b.pointsEarned ? `· earned ${b.pointsEarned} pts` : ''}</div>
        </div>
        <strong>${fmtCurrency(b.total)}</strong>
      </div>`;
    }).join('');
}

/* ---------- Edit ---------- */

function fillEditForm() {
  document.getElementById('editName').value = customer.name || '';
  document.getElementById('editMobile').value = customer.mobile || '';
  document.getElementById('editDob').value = customer.dob || '';
  document.getElementById('editAnniversary').value = customer.anniversary || '';
  document.getElementById('editAddress').value = customer.address || '';
  document.getElementById('editSkinType').value = customer.skinType || '';
  document.getElementById('editBeautician').value = customer.preferredBeautician || '';
  document.getElementById('editNotes').value = customer.notes || '';
}

const origShowModal = editModal.showModal.bind(editModal);
editModal.showModal = function () {
  fillEditForm();
  origShowModal();
};

document.getElementById('editForm').addEventListener('submit', async () => {
  const data = {
    name: document.getElementById('editName').value.trim(),
    mobile: document.getElementById('editMobile').value.trim(),
    dob: document.getElementById('editDob').value,
    anniversary: document.getElementById('editAnniversary').value,
    address: document.getElementById('editAddress').value.trim(),
    skinType: document.getElementById('editSkinType').value,
    preferredBeautician: document.getElementById('editBeautician').value.trim(),
    notes: document.getElementById('editNotes').value.trim(),
  };
  customer = await DB.update('customers', customerId, data);
  editModal.close();
  loadProfile();
});

/* ---------- Photos ---------- */

function resizeImageFile(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(file, type) {
  if (!file) return;
  const dataUrl = await resizeImageFile(file);
  await DB.add('photos', { customerId, type, localDataUrl: dataUrl, uploaded: false });
  await loadPhotos();
}

document.getElementById('beforeInput').addEventListener('change', (e) => handlePhotoUpload(e.target.files[0], 'before'));
document.getElementById('afterInput').addEventListener('change', (e) => handlePhotoUpload(e.target.files[0], 'after'));

async function loadPhotos() {
  const photos = await DB.getByIndex('photos', 'customerId', customerId);
  const el = document.getElementById('photoGrid');
  if (!photos.length) {
    el.innerHTML = '<div class="empty-state text-soft" style="grid-column: 1/-1;">No photos yet.</div>';
    return;
  }
  el.innerHTML = photos
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => `
      <div>
        <img class="photo-thumb" src="${p.localDataUrl}" alt="${p.type}">
        <div class="text-center" style="text-align:center;"><span class="badge ${p.type === 'before' ? '' : 'success'}" style="margin-top:4px;">${p.type}</span></div>
      </div>
    `).join('');
}

loadProfile();
