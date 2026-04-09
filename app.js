/* ── Backend & State ── */
var BACKEND_URL     = localStorage.getItem('img_backend_url') || '';
var originalFile    = null;
var removedBgB64    = null;
var generatedImages = [];
var selectedObjects = new Set();
var selectedTheme   = 'tropical beach with palm trees and golden sand';
var selectedMood    = 'bright and vibrant with natural sunlight';
var bgRemovalReady  = false;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', function () {
  setupUpload();
  setupChips();
  checkBackend();
  loadBgRemovalLib();
  if (BACKEND_URL) document.getElementById('backend-url-input').value = BACKEND_URL;
});

/* ── Load @imgly/background-removal from CDN ── */
function loadBgRemovalLib() {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/background-removal.js';
  script.onload = function () {
    bgRemovalReady = true;
    console.log('Background removal library loaded');
  };
  script.onerror = function () {
    console.warn('BG removal lib failed to load — will skip removal');
    bgRemovalReady = false;
  };
  document.head.appendChild(script);
}

/* ── Backend check ── */
async function checkBackend() {
  var pill = document.getElementById('backend-status');
  if (!BACKEND_URL) {
    pill.textContent = '⬤ backend not configured';
    pill.className   = 'status-pill status-err';
    return;
  }
  try {
    var r = await fetch(BACKEND_URL + '/');
    pill.textContent = r.ok ? '⬤ backend connected' : '⬤ backend error';
    pill.className   = r.ok ? 'status-pill status-ok' : 'status-pill status-err';
  } catch {
    pill.textContent = '⬤ backend unreachable';
    pill.className   = 'status-pill status-err';
  }
}

/* ── Upload ── */
function setupUpload() {
  var dz  = document.getElementById('drop-zone');
  var fin = document.getElementById('file-input');
  dz.addEventListener('click', function () { fin.click(); });
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.style.borderColor = 'var(--green-mid)'; });
  dz.addEventListener('dragleave', function () { dz.style.borderColor = ''; });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.style.borderColor = '';
    var f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  });
  fin.addEventListener('change', function (e) {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });
}

function handleFile(file) {
  originalFile = file;
  var reader   = new FileReader();
  reader.onload = function (ev) {
    document.getElementById('original-img').src = ev.target.result;
    document.getElementById('preview-area').style.display  = 'block';
    document.getElementById('drop-zone').style.display     = 'none';
    setProgress(1);
    removeBackground(file);
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  originalFile    = null;
  removedBgB64    = null;
  generatedImages = [];
  document.getElementById('preview-area').style.display   = 'none';
  document.getElementById('drop-zone').style.display      = 'block';
  document.getElementById('removed-bg-img').style.display = 'none';
  document.getElementById('removing-bg').style.display    = 'flex';
  document.getElementById('results-area').style.display   = 'none';
  document.getElementById('loading-area').style.display   = 'none';
  document.getElementById('gen-btn').disabled             = false;
  lockStep(2); lockStep(3);
  setProgress(0);
}

/* ── Background Removal — runs 100% in browser ── */
async function removeBackground(file) {
  var removingDiv = document.getElementById('removing-bg');
  var removedImg  = document.getElementById('removed-bg-img');
  var statusEl    = document.getElementById('removing-status');

  removingDiv.style.display    = 'flex';
  removedImg.style.display     = 'none';

  /* Update status text */
  if (statusEl) statusEl.textContent = 'Loading AI model (first time only)...';

  /* Wait for lib to load if still loading */
  if (!bgRemovalReady) {
    await waitForLib(10000);
  }

  if (!bgRemovalReady || typeof window.BackgroundRemoval === 'undefined') {
    console.warn('BG removal not available — using original');
    var reader = new FileReader();
    reader.onload = function (ev) {
      removedBgB64 = ev.target.result.split(',')[1];
      showRemovedBg(ev.target.result);
    };
    reader.readAsDataURL(file);
    return;
  }

  try {
    if (statusEl) statusEl.textContent = 'Removing background...';

    /* Use @imgly/background-removal */
    var config = {
      publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/',
      progress: function (key, current, total) {
        if (statusEl && total > 0) {
          var pct = Math.round((current / total) * 100);
          statusEl.textContent = 'Removing background... ' + pct + '%';
        }
      }
    };

    var resultBlob = await window.BackgroundRemoval.removeBackground(file, config);
    var resultUrl  = URL.createObjectURL(resultBlob);

    /* Convert blob to base64 for later use */
    var reader = new FileReader();
    reader.onload = function (ev) {
      removedBgB64 = ev.target.result.split(',')[1];
    };
    reader.readAsDataURL(resultBlob);

    showRemovedBg(resultUrl);
    if (statusEl) statusEl.textContent = 'Background removed!';

  } catch (err) {
    console.error('BG removal failed:', err);
    /* Fallback to original */
    var reader2 = new FileReader();
    reader2.onload = function (ev) {
      removedBgB64 = ev.target.result.split(',')[1];
      showRemovedBg(ev.target.result);
    };
    reader2.readAsDataURL(file);
    if (statusEl) statusEl.textContent = 'Using original (removal failed)';
  }
}

function waitForLib(timeout) {
  return new Promise(function (resolve) {
    var start    = Date.now();
    var interval = setInterval(function () {
      if (bgRemovalReady || Date.now() - start > timeout) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}

function showRemovedBg(src) {
  var img     = document.getElementById('removed-bg-img');
  img.src     = src;
  img.style.display = 'block';
  document.getElementById('removing-bg').style.display = 'none';
  unlockStep(2);
  unlockStep(3);
  setProgress(2);
}

/* ── Chips ── */
function setupChips() {
  /* Theme */
  document.getElementById('theme-grid').addEventListener('click', function (e) {
    var chip = e.target.closest('.theme-chip');
    if (!chip) return;
    document.querySelectorAll('.theme-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    selectedTheme = chip.dataset.theme;
    document.getElementById('custom-theme').value = '';
  });
  document.getElementById('custom-theme').addEventListener('input', function () {
    if (this.value.trim()) {
      document.querySelectorAll('.theme-chip').forEach(function (c) { c.classList.remove('active'); });
      selectedTheme = this.value.trim();
    }
  });

  /* Objects */
  document.getElementById('objects-grid').addEventListener('click', function (e) {
    var chip = e.target.closest('.obj-chip');
    if (!chip) return;
    chip.classList.toggle('active');
    if (chip.classList.contains('active')) selectedObjects.add(chip.dataset.obj);
    else selectedObjects.delete(chip.dataset.obj);
  });

  /* Mood */
  document.querySelector('.mood-row').addEventListener('click', function (e) {
    var chip = e.target.closest('.mood-chip');
    if (!chip) return;
    document.querySelectorAll('.mood-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    selectedMood = chip.dataset.mood;
  });
}

function updateCount(v) {
  document.getElementById('count-display').textContent = v + ' variations';
}

/* ── Generate ── */
async function generateImages() {
  if (!BACKEND_URL) {
    document.getElementById('setup-warning').style.display = 'block';
    showSetup();
    return;
  }

  var theme   = document.getElementById('custom-theme').value.trim() || selectedTheme;
  var objects = document.getElementById('custom-objects').value.trim()
    || (selectedObjects.size > 0 ? Array.from(selectedObjects).join(', ') : '');
  var count   = parseInt(document.getElementById('variation-count').value);
  var imgB64  = removedBgB64 || (document.getElementById('original-img').src.split(',')[1]);

  var btn = document.getElementById('gen-btn');
  btn.disabled = true;

  document.getElementById('results-area').style.display = 'none';
  document.getElementById('loading-area').style.display = 'block';
  setProgress(3);

  generatedImages = [];
  var results     = [];
  var bar         = document.getElementById('loading-bar');
  var prog        = document.getElementById('loading-progress');

  var styleVariants = [
    'photorealistic product photography',
    'lifestyle brand photography',
    'editorial magazine style',
    'vibrant social media style',
    'clean commercial photography',
    'artistic product shot',
    'dynamic action shot',
    'flat lay overhead view',
    'close-up detail shot',
    'wide environmental shot',
    'golden ratio composition',
    'rule of thirds composition'
  ];

  for (var i = 0; i < count; i++) {
    var pct   = Math.round((i / count) * 100);
    bar.style.width  = pct + '%';
    prog.textContent = 'Generating image ' + (i + 1) + ' of ' + count + '...';

    var style = styleVariants[i % styleVariants.length];

    try {
      var resp = await fetch(BACKEND_URL + '/edit-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgB64, theme, objects, mood: selectedMood, style, index: i })
      });

      if (!resp.ok) throw new Error('Generation failed');
      var data = await resp.json();
      var imgUrl = data.url || ('data:image/png;base64,' + data.b64);
      results.push({ url: imgUrl, b64: data.b64, desc: style + ' · ' + theme, index: i + 1 });

    } catch (err) {
      console.error('Image ' + (i + 1) + ' failed:', err);
      results.push({ url: null, b64: null, desc: 'Generation failed', index: i + 1, error: true });
    }

    bar.style.width = Math.round(((i + 1) / count) * 100) + '%';
  }

  generatedImages = results;
  bar.style.width  = '100%';
  prog.textContent = 'All done!';

  setTimeout(function () {
    document.getElementById('loading-area').style.display = 'none';
    renderResults(results);
    setProgress(4);
    btn.disabled = false;
  }, 500);
}

/* ── Render Results ── */
function renderResults(results) {
  var area       = document.getElementById('results-area');
  var grid       = document.getElementById('results-grid');
  var successful = results.filter(function (r) { return !r.error && r.url; });

  document.getElementById('results-title').textContent =
    successful.length + ' of ' + results.length + ' images generated';

  grid.innerHTML = results.map(function (r, idx) {
    if (r.error || !r.url) {
      return '<div class="result-card"><div class="result-img-wrap" style="display:flex;align-items:center;justify-content:center;background:var(--red-light)">'
        + '<span style="font-size:12px;color:var(--red-deep);padding:1rem;text-align:center">Generation failed</span>'
        + '</div><div class="result-card-body"><div class="result-desc">Image ' + r.index + ' failed</div></div></div>';
    }
    return '<div class="result-card" id="card-' + idx + '">'
      + '<div class="result-img-wrap">'
      + '<img src="' + r.url + '" alt="Variation ' + r.index + '" loading="lazy">'
      + '<span class="result-badge">HD #' + r.index + '</span>'
      + '</div>'
      + '<div class="result-card-body">'
      + '<div class="result-desc">' + r.desc + '</div>'
      + '<div class="result-actions">'
      + '<button class="btn-dl" onclick="downloadImage(' + idx + ')">⬇ Download PNG</button>'
      + '<button class="btn-preview" onclick="previewImage(\'' + r.url + '\')">⤢</button>'
      + '</div></div></div>';
  }).join('');

  area.style.display = 'block';
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Download single ── */
async function downloadImage(idx) {
  var img = generatedImages[idx];
  if (!img || img.error) return;

  var btn = document.querySelector('#card-' + idx + ' .btn-dl');
  if (btn) { btn.textContent = '⏳ Downloading...'; btn.disabled = true; }

  try {
    var b64;

    /* If we already have b64, use it directly — no server needed */
    if (img.b64) {
      b64 = img.b64;
    } else if (img.url && img.url.startsWith('data:')) {
      b64 = img.url.split(',')[1];
    } else {
      /* Fetch via backend proxy */
      var resp = await fetch(BACKEND_URL + '/proxy-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: img.url, b64: img.b64 })
      });
      if (!resp.ok) throw new Error('Download failed');
      var data = await resp.json();
      b64 = data.image;
    }

    var link      = document.createElement('a');
    link.href     = 'data:image/png;base64,' + b64;
    link.download = 'probiotic-fizzy-' + img.index + '-hd.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('Download failed:', err);
    if (img.url) window.open(img.url, '_blank');
  }

  if (btn) { btn.textContent = '⬇ Download PNG'; btn.disabled = false; }
}

/* ── Download all ZIP ── */
async function downloadAll() {
  var btn = document.getElementById('download-all-btn');
  btn.textContent = '⏳ Creating ZIP...';
  btn.disabled    = true;

  var valid = generatedImages.filter(function (r) { return !r.error && r.url; });

  try {
    var resp = await fetch(BACKEND_URL + '/download-all', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        images: valid.map(function (r, i) {
          return { url: r.url, b64: r.b64, index: r.index };
        })
      })
    });

    if (!resp.ok) throw new Error('ZIP failed');
    var data = await resp.json();

    var link      = document.createElement('a');
    link.href     = 'data:application/zip;base64,' + data.zip;
    link.download = 'probiotic-fizzy-ai-images.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    /* Fallback — download one by one */
    alert('ZIP failed. Downloading individually...');
    for (var i = 0; i < valid.length; i++) {
      await downloadImage(generatedImages.indexOf(valid[i]));
      await new Promise(function (r) { setTimeout(r, 300); });
    }
  }

  btn.textContent = '⬇ Download all as ZIP';
  btn.disabled    = false;
}

/* ── Preview fullscreen ── */
function previewImage(url) {
  var overlay = document.createElement('div');
  overlay.className = 'fullscreen-overlay';
  overlay.innerHTML = '<img src="' + url + '" alt="Preview">';
  overlay.addEventListener('click', function () { document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
}

/* ── Progress & Steps ── */
function setProgress(step) {
  for (var i = 1; i <= 4; i++) {
    var el = document.getElementById('prog-' + i);
    el.classList.remove('active', 'done');
    if (i < step) el.classList.add('done');
    else if (i === step) el.classList.add('active');
  }
}
function unlockStep(n) { document.getElementById('step-' + n).classList.remove('locked'); }
function lockStep(n)   { document.getElementById('step-' + n).classList.add('locked'); }

/* ── Setup ── */
function showSetup() { document.getElementById('setup-panel').style.display = 'flex'; }
function hideSetup() { document.getElementById('setup-panel').style.display = 'none'; }
function saveBackend() {
  BACKEND_URL = document.getElementById('backend-url-input').value.trim().replace(/\/$/, '');
  localStorage.setItem('img_backend_url', BACKEND_URL);
  document.getElementById('backend-saved-msg').style.display = 'block';
  document.getElementById('setup-warning').style.display     = 'none';
  setTimeout(function () { document.getElementById('backend-saved-msg').style.display = 'none'; }, 2000);
  checkBackend();
  hideSetup();
}
