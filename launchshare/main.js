const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fillYearSelect(selectEl, includeEmpty) {
  const startYear = new Date().getFullYear();
  if (includeEmpty && !selectEl.querySelector('option[value=""]')) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    selectEl.appendChild(empty);
  }
  for (let year = startYear; year <= startYear + 8; year += 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    selectEl.appendChild(option);
  }
}

function getLaunchDateValue() {
  const month = document.getElementById('launch-month').value;
  const year = document.getElementById('launch-year').value;
  return month && year ? `${year}-${month}` : '';
}

function getLaunchDateMaxValue() {
  const month = document.getElementById('launch-date-max-month').value;
  const year = document.getElementById('launch-date-max-year').value;
  return month && year ? `${year}-${month}` : '';
}

function setLaunchDateDefaults() {
  document.getElementById('launch-month').value = '10';
  document.getElementById('launch-year').value = '2026';
  document.getElementById('launch-date-max-month').value = '';
  document.getElementById('launch-date-max-year').value = '';
}

function initDatePickers() {
  fillYearSelect(document.getElementById('launch-year'), false);
  fillYearSelect(document.getElementById('launch-date-max-year'), true);
  setLaunchDateDefaults();

  ['launch-month', 'launch-year', 'launch-date-max-month', 'launch-date-max-year'].forEach((id) => {
    document.getElementById(id).addEventListener('change', updateSidebar);
  });
}

let currentStep = 1;

function updateProgress(step) {
  document.querySelectorAll('.progress-step').forEach((el, i) => {
    const n = i + 1;
    el.classList.remove('active', 'done');
    if (n < step) el.classList.add('done');
    if (n === step) el.classList.add('active');
  });

  
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
  const date = getLaunchDateValue();
  if (!date) {
    shakeInput('launch-month');
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

document.getElementById('orbit-selector').addEventListener('click', (e) => {
  const btn = e.target.closest('.orbit-btn');
  if (!btn) return;
  document.querySelectorAll('.orbit-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('orbit-value').value = btn.dataset.orbit;
  updateSidebar();
});

function updateSidebar() {
  const orbit = document.getElementById('orbit-value').value || 'LEO';
  const date = getLaunchDateValue();
  const satName = document.getElementById('sat-name').value.trim();

  document.getElementById('sidebar-orbit').textContent = orbit;

  if (date) {
    const [year, month] = date.split('-');
    document.getElementById('sidebar-date').textContent = MONTH_SHORT[parseInt(month, 10) - 1] + ' ' + year;
  }

  document.getElementById('sidebar-sat').textContent = satName || '—';
}

document.getElementById('discord-name').addEventListener('input', updateSidebar);
document.getElementById('sat-name').addEventListener('input', updateSidebar);

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

uploadZone.addEventListener('click', (e) => {
  if (e.target.closest('.upload-remove') || e.target.closest('#upload-selected')) return;
  fileInput.click();
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
  const allowed = ['.nbt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    alert('File type not allowed. Only .nbt files are accepted.');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    alert('File is too large. Max size is 3 MB.');
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

function showFormSuccess() {
  document.getElementById('launch-form').style.display = 'none';
  document.querySelector('.form-progress').style.display = 'none';
  document.getElementById('form-success').style.display = 'block';

  document.getElementById('form-success-sub').innerHTML =
    'Your request was sent to the ISA team. We will review it within <strong>48 hours</strong>. Make sure you\'re in the <a href="https:
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
    launchDate: getLaunchDateValue(),
    launchDateMax: getLaunchDateMaxValue(),
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

    showFormSuccess();
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
  setLaunchDateDefaults();
  document.getElementById('orbit-value').value = 'LEO';
  document.querySelectorAll('.orbit-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.orbit-btn[data-orbit="LEO"]').classList.add('active');

  
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) {
    submitBtn.textContent = 'Submit Launch Request';
    submitBtn.disabled = false;
  }

  showStep(1);
  updateSidebar();
}

initDatePickers();
updateProgress(1);
updateSidebar();