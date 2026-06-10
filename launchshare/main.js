/* =============================================
   LAUNCHSHARE — ISA Platform JS
   ============================================= */

// Nav scroll + burger menu are handled by ../shared.js

// ---- FORM STATE ----
let currentStep = 1;

function updateProgress(step) {
  document.querySelectorAll('.progress-step').forEach((el, i) => {
    const n = i + 1;
    el.classList.remove('active', 'done');
    if (n < step) el.classList.add('done');
    if (n === step) el.classList.add('active');
  });

  // update done check icon for done steps
  document.querySelectorAll('.progress-step.done span').forEach(s => {
    s.innerHTML = '✓';
  });

  document.querySelectorAll('.progress-step:not(.done) span').forEach(s => {
    const n = s.closest('.progress-step').dataset.step;
    if (n) s.innerHTML = n;
  });
}

function showStep(step) {
  document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('step-' + step);
  if (target) target.classList.add('active');
  currentStep = step;
  updateProgress(step);
}

function validateStep1() {
  const discord = document.getElementById('discord-name').value.trim();
  const satName = document.getElementById('sat-name').value.trim();
  if (!discord) {
    shakeInput('discord-name');
    return false;
  }
  if (!satName) {
    shakeInput('sat-name');
    return false;
  }
  return true;
}

function validateStep2() {
  const date = document.getElementById('launch-date').value;
  if (!date) {
    shakeInput('launch-date');
    return false;
  }
  return true;
}

function nextStep(from) {
  if (from === 1 && !validateStep1()) return;
  if (from === 2 && !validateStep2()) return;
  showStep(from + 1);
  updateSidebar();
  window.scrollTo({ top: document.getElementById('book').offsetTop - 80, behavior: 'smooth' });
}

function prevStep(from) {
  showStep(from - 1);
  window.scrollTo({ top: document.getElementById('book').offsetTop - 80, behavior: 'smooth' });
}

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#ef4444';
  el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 1800);
  el.focus();
}

// ---- ORBIT SELECTOR ----
document.getElementById('orbit-selector').addEventListener('click', (e) => {
  const btn = e.target.closest('.orbit-btn');
  if (!btn) return;
  document.querySelectorAll('.orbit-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('orbit-value').value = btn.dataset.orbit;
  updateSidebar();
});

// ---- SIDEBAR LIVE UPDATE ----
function updateSidebar() {
  const orbit = document.getElementById('orbit-value').value || 'LEO';
  const date = document.getElementById('launch-date').value;
  const satName = document.getElementById('sat-name').value.trim();

  document.getElementById('sidebar-orbit').textContent = orbit;

  if (date) {
    const [year, month] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('sidebar-date').textContent = months[parseInt(month, 10) - 1] + ' ' + year;
  }

  document.getElementById('sidebar-sat').textContent = satName || '—';
}

// listen for live inputs
document.getElementById('discord-name').addEventListener('input', updateSidebar);
document.getElementById('sat-name').addEventListener('input', updateSidebar);
document.getElementById('launch-date').addEventListener('change', updateSidebar);

// ---- FILE UPLOAD ----
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

uploadZone.addEventListener('click', (e) => {
  if (e.target === uploadZone || e.target.id === 'upload-inner' || e.target.closest('#upload-inner')) {
    fileInput.click();
  }
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const allowed = ['.nbt', '.snbt', '.json', '.png', '.jpg', '.jpeg'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    alert('File type not allowed. Accepted: .nbt, .snbt, .json, .png, .jpg');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert('File is too large. Max size is 4 MB.');
    return;
  }
  document.getElementById('upload-inner').style.display = 'none';
  document.getElementById('upload-selected').style.display = 'flex';
  document.getElementById('file-display-name').textContent = file.name;
}

function removeFile() {
  fileInput.value = '';
  document.getElementById('upload-inner').style.display = 'block';
  document.getElementById('upload-selected').style.display = 'none';
}

// ---- CHAR COUNTER ----
const textarea = document.getElementById('mission-desc');
const charCount = document.getElementById('char-count');
textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = len;
  if (len > 720) {
    charCount.style.color = '#f59e0b';
  } else if (len > 780) {
    charCount.style.color = '#ef4444';
  } else {
    charCount.style.color = '';
  }
  if (len > 800) {
    textarea.value = textarea.value.slice(0, 800);
    charCount.textContent = 800;
  }
});

function hideFormError() {
  const el = document.getElementById('form-error');
  el.style.display = 'none';
  el.textContent = '';
}

function showFormError(message) {
  const el = document.getElementById('form-error');
  el.textContent = message;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showFormSuccess(dmSent) {
  document.getElementById('launch-form').style.display = 'none';
  document.querySelector('.form-progress').style.display = 'none';
  document.getElementById('form-success').style.display = 'block';

  const sub = document.getElementById('form-success-sub');
  if (dmSent) {
    sub.innerHTML = 'A confirmation was sent to your Discord DMs. Make sure you\'re in the <a href="https://discord.gg/CMDSKwTBnm" target="_blank">ISA Discord</a>.';
  } else {
    sub.innerHTML = 'Your request was posted for the ISA team. We couldn\'t DM you — check that your Discord username is correct and that you\'re in the <a href="https://discord.gg/CMDSKwTBnm" target="_blank">ISA Discord</a> with DMs open.';
  }
}

function getLaunchApiUrl() {
  const url = (window.LAUNCHSHARE_API || '').trim();
  return url || '/api/submit';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the uploaded file.'));
    reader.readAsDataURL(file);
  });
}

async function buildSubmitPayload() {
  const payload = {
    discord: document.getElementById('discord-name').value.trim(),
    satName: document.getElementById('sat-name').value.trim(),
    orbit: document.getElementById('orbit-value').value,
    launchDate: document.getElementById('launch-date').value,
    launchDateMax: document.getElementById('launch-date-max').value,
    description: document.getElementById('mission-desc').value.trim(),
    file: null,
  };

  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    payload.file = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      data: await readFileAsBase64(file),
    };
  }

  return payload;
}

// ---- FORM SUBMIT ----
document.getElementById('launch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFormError();

  if (!validateStep1()) {
    showStep(1);
    return;
  }
  if (!validateStep2()) {
    showStep(2);
    return;
  }

  const submitBtn = e.target.querySelector('.btn-submit');
  const defaultLabel = submitBtn.textContent;
  submitBtn.textContent = 'Sending…';
  submitBtn.disabled = true;

  try {
    const response = await fetch(getLaunchApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await buildSubmitPayload()),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Submission failed. Please try again.');
    }

    showFormSuccess(Boolean(result.dmSent));
  } catch (error) {
    showFormError(error.message || 'Could not submit your request. Try again in a moment.');
    submitBtn.textContent = defaultLabel;
    submitBtn.disabled = false;
  }
});

function resetForm() {
  hideFormError();
  document.getElementById('launch-form').reset();
  document.getElementById('launch-form').style.display = 'block';
  document.querySelector('.form-progress').style.display = 'flex';
  document.getElementById('form-success').style.display = 'none';
  removeFile();
  charCount.textContent = '0';
  document.getElementById('orbit-value').value = 'LEO';
  document.querySelectorAll('.orbit-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.orbit-btn[data-orbit="LEO"]').classList.add('active');

  // re-enable submit
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) {
    submitBtn.textContent = 'Submit Launch Request';
    submitBtn.disabled = false;
  }

  showStep(1);
  updateSidebar();
}

// ---- INIT ----
updateProgress(1);
updateSidebar();
