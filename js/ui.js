// ============================================================
// UI UTILITIES
// ============================================================

function showModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

function closeModalOutside(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => showModal(to), 150);
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showFormSuccess(el, msg) {
  el.textContent = msg;
  el.className = 'form-success';
}

function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.classList.toggle('hidden', loading);
  if (loader) loader.classList.toggle('hidden', !loading);
}

// Toast notifications
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✕'}</span>
    <span>${msg}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// File preview for screenshot upload
function previewFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const drop = document.getElementById('fileDrop');
  const preview = document.getElementById('filePreview');
  const img = document.getElementById('previewImg');
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    img.src = ev.target.result;
    drop.classList.add('hidden');
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  document.getElementById('regScreenshot').value = '';
  document.getElementById('fileDrop').classList.remove('hidden');
  document.getElementById('filePreview').classList.add('hidden');
}

// Format date nicely
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Debounce
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// Render sidebar active state
function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// Render user chip in sidebar
function renderUserChip(profile) {
  const chip = document.getElementById('userChip');
  if (!chip || !profile) return;
  chip.innerHTML = `
    <div class="user-avatar">${profile.nickname.charAt(0).toUpperCase()}</div>
    <div>
      <div class="user-name">${profile.nickname}</div>
      <div class="user-tag">${profile.brawl_tag}</div>
    </div>
  `;
}

// Escape HTML
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Handle file drag-and-drop
function initFileDrop() {
  const drop = document.getElementById('fileDrop');
  if (!drop) return;
  
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.style.borderColor = 'var(--neon)';
  });
  drop.addEventListener('dragleave', () => {
    drop.style.borderColor = '';
  });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      document.getElementById('regScreenshot').files = e.dataTransfer.files;
      previewFile({ target: { files: [file] } });
    }
  });
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  initFileDrop();
  
  // Keyboard: close modal with ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => {
        m.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  });
});
