// ---- State ----
const state = {
  files: [],          // [{ filePath, baseName, tags, checked }]
  dirtyFields: new Set(), // field keys modified by the user
  artDirty: false,
  newArtFilePath: null,
  newArtDataUrl: null,
  updating: false,    // suppress dirty tracking during programmatic field updates
};

// ---- DOM references ----
const emptyStateEl    = document.getElementById('empty-state');
const editorStateEl   = document.getElementById('editor-state');
const fileListEl      = document.getElementById('file-list');
const closeFileBtn    = document.getElementById('close-file-btn');
const hamburgerBtn    = document.getElementById('hamburger-btn');
const hamburgerMenu   = document.getElementById('hamburger-menu');
const applyBtn        = document.getElementById('apply-btn');
const artImg          = document.getElementById('art-img');
const artPlaceholder  = document.getElementById('art-placeholder');
const emptyOverlay    = document.getElementById('empty-drag-overlay');
const editorOverlay   = document.getElementById('editor-drag-overlay');

// ---- Helpers ----

function getBaseName(filePath) {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getChecked() {
  return state.files.filter(f => f.checked);
}

function hasDirtyChanges() {
  return state.dirtyFields.size > 0 || state.artDirty;
}

function clearDirty() {
  state.dirtyFields.clear();
  state.artDirty = false;
  state.newArtFilePath = null;
  state.newArtDataUrl = null;
}

// ---- View transitions ----

function showEditor() {
  emptyStateEl.classList.add('hidden');
  editorStateEl.classList.remove('hidden');
}

function showEmpty() {
  editorStateEl.classList.add('hidden');
  emptyStateEl.classList.remove('hidden');
}

// ---- Toast ----

let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 3500);
}

// ---- File loading ----

async function addFiles(paths) {
  const resolved = await window.minid3.resolvePaths(paths);
  const newPaths = resolved.filter(p => !state.files.some(f => f.filePath === p));
  if (newPaths.length === 0) return;

  const tagResults = await window.minid3.readTags(newPaths);
  for (const result of tagResults) {
    state.files.push({
      filePath: result.filePath,
      baseName: getBaseName(result.filePath),
      tags: result,
      checked: true,
    });
  }

  showEditor();
  renderFileList();
  updateTagFields();
}

// ---- File list rendering ----

function renderFileList() {
  fileListEl.innerHTML = '';
  for (const file of state.files) {
    const item = document.createElement('div');
    item.className = 'file-item' + (file.checked ? ' is-checked' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = file.checked;
    cb.addEventListener('change', () => handleCheckChange(file, cb.checked));

    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
    nameEl.textContent = file.baseName;
    nameEl.title = file.filePath;

    item.append(cb, nameEl);
    // Clicking the row row (not the checkbox itself) toggles the checkbox
    item.addEventListener('click', (e) => {
      if (e.target !== cb) cb.click();
    });
    fileListEl.appendChild(item);
  }

  closeFileBtn.disabled = getChecked().length === 0;
}

async function handleCheckChange(file, newChecked) {
  if (hasDirtyChanges()) {
    const ok = confirm('You have unapplied changes. These will be lost if you change your selection. Continue?');
    if (!ok) {
      renderFileList(); // revert checkbox visual
      return;
    }
    clearDirty();
  }
  file.checked = newChecked;
  renderFileList();
  updateTagFields();
}

// ---- Tag field display ----

function updateArtDisplay() {
  if (state.artDirty) {
    // New art was selected by the user — already shown
    return;
  }

  const checked = getChecked();
  if (checked.length === 0) {
    artImg.src = '';
    artImg.classList.remove('visible');
    artPlaceholder.textContent = 'No art';
    artPlaceholder.style.display = '';
    return;
  }

  const images = checked.map(f => f.tags.image);
  const allSame = images.every(img => img === images[0]);

  if (allSame && images[0]) {
    artImg.src = images[0];
    artImg.classList.add('visible');
    artPlaceholder.style.display = 'none';
  } else if (allSame && !images[0]) {
    artImg.src = '';
    artImg.classList.remove('visible');
    artPlaceholder.textContent = 'No art';
    artPlaceholder.style.display = '';
  } else {
    artImg.src = '';
    artImg.classList.remove('visible');
    artPlaceholder.textContent = '(Multiple values)';
    artPlaceholder.style.display = '';
  }
}

function updateTagFields() {
  state.updating = true;
  const checked = getChecked();

  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field;

    // Preserve fields the user has already edited
    if (state.dirtyFields.has(key)) {
      el.disabled = false;
      return;
    }

    if (checked.length === 0) {
      el.value = '';
      el.placeholder = '';
      el.disabled = true;
      return;
    }

    el.disabled = false;
    const values = checked.map(f => f.tags[key] || '');
    const allSame = values.every(v => v === values[0]);

    if (allSame) {
      el.value = values[0];
      el.placeholder = '';
    } else {
      el.value = '';
      el.placeholder = '(Multiple values)';
    }
  });

  updateArtDisplay();
  updateApplyButton();
  state.updating = false;
}

function updateApplyButton() {
  const n = getChecked().length;
  applyBtn.textContent = `Apply changes to ${n} file(s)`;
  applyBtn.disabled = n === 0;
}

// ---- Dirty tracking ----

document.querySelectorAll('[data-field]').forEach(el => {
  el.addEventListener('input', () => {
    if (!state.updating) {
      state.dirtyFields.add(el.dataset.field);
    }
  });
});

// ---- Apply changes ----

applyBtn.addEventListener('click', async () => {
  const checked = getChecked();
  if (checked.length === 0) return;

  // Build update object from dirty fields only
  const updates = {};
  for (const key of state.dirtyFields) {
    const el = document.querySelector(`[data-field="${key}"]`);
    if (el) updates[key] = el.value;
  }
  if (state.artDirty && state.newArtFilePath) {
    updates.artFilePath = state.newArtFilePath;
  }

  if (Object.keys(updates).length === 0) {
    showToast('No changes to apply', 'info');
    return;
  }

  applyBtn.disabled = true;
  applyBtn.textContent = 'Applying…';

  try {
    const filePaths = checked.map(f => f.filePath);
    const result = await window.minid3.writeTags(filePaths, updates);

    if (result.success) {
      showToast(`Applied to ${filePaths.length} file(s)`, 'success');

      // Refresh tags from disk for changed files
      const refreshed = await window.minid3.readTags(filePaths);
      for (const tagResult of refreshed) {
        const file = state.files.find(f => f.filePath === tagResult.filePath);
        if (file) file.tags = tagResult;
      }
      clearDirty();
      updateTagFields();
    } else {
      const failCount = result.errors.length;
      showToast(`Failed to write ${failCount} file(s)`, 'error');
      console.error('Write errors:', result.errors);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  } finally {
    updateApplyButton();
  }
});

// ---- Album art selection ----

document.getElementById('select-art-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  const result = await window.minid3.openArtDialog();
  if (!result) return;

  state.artDirty = true;
  state.newArtFilePath = result.filePath;
  state.newArtDataUrl = result.dataUrl;

  artImg.src = result.dataUrl;
  artImg.classList.add('visible');
  artPlaceholder.style.display = 'none';
});

// ---- Hamburger menu ----

function openMenu() { hamburgerMenu.classList.remove('hidden'); }
function closeMenu() { hamburgerMenu.classList.add('hidden'); }

hamburgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  hamburgerMenu.classList.contains('hidden') ? openMenu() : closeMenu();
});

document.addEventListener('click', () => closeMenu());
hamburgerMenu.addEventListener('click', (e) => e.stopPropagation());

async function setAllChecked(newChecked) {
  if (hasDirtyChanges()) {
    const ok = confirm('You have unapplied changes. These will be lost if you change your selection. Continue?');
    if (!ok) return;
    clearDirty();
  }
  state.files.forEach(f => { f.checked = newChecked; });
  renderFileList();
  updateTagFields();
}

document.getElementById('menu-select-all').addEventListener('click', () => {
  closeMenu();
  setAllChecked(true);
});

document.getElementById('menu-deselect-all').addEventListener('click', () => {
  closeMenu();
  setAllChecked(false);
});

document.getElementById('menu-title-to-filename').addEventListener('click', async () => {
  closeMenu();
  const checked = getChecked();
  if (checked.length === 0) { showToast('No files selected', 'info'); return; }
  const ok = confirm(`Are you sure you want to apply this update to ${checked.length} file(s)?`);
  if (!ok) return;

  let errorCount = 0;
  for (const file of checked) {
    const title = file.baseName.replace(/\.mp3$/i, '');
    const result = await window.minid3.writeTags([file.filePath], { title });
    if (!result.success) errorCount++;
    else {
      const refreshed = await window.minid3.readTags([file.filePath]);
      if (refreshed[0]) file.tags = refreshed[0];
    }
  }

  clearDirty();
  updateTagFields();
  if (errorCount > 0) {
    showToast(`Failed on ${errorCount} file(s)`, 'error');
  } else {
    showToast(`Titles set for ${checked.length} file(s)`, 'success');
  }
});

document.getElementById('menu-remove-id3').addEventListener('click', async () => {
  closeMenu();
  const checked = getChecked();
  if (checked.length === 0) { showToast('No files selected', 'info'); return; }
  const ok = confirm(`Are you sure you want to apply this update to ${checked.length} file(s)?`);
  if (!ok) return;

  const filePaths = checked.map(f => f.filePath);
  const result = await window.minid3.removeTags(filePaths);

  const refreshed = await window.minid3.readTags(filePaths);
  for (const tagResult of refreshed) {
    const file = state.files.find(f => f.filePath === tagResult.filePath);
    if (file) file.tags = tagResult;
  }

  clearDirty();
  updateTagFields();
  if (!result.success) {
    showToast(`Failed on ${result.errors.length} file(s)`, 'error');
  } else {
    showToast(`ID3 data removed from ${checked.length} file(s)`, 'success');
  }
});

// ---- Add / close file buttons ----

document.getElementById('add-file-btn').addEventListener('click', async () => {
  const paths = await window.minid3.openFilesDialog();
  if (paths.length > 0) await addFiles(paths);
});

closeFileBtn.addEventListener('click', async () => {
  if (hasDirtyChanges()) {
    const ok = confirm('You have unapplied changes. These will be lost. Continue?');
    if (!ok) return;
  }
  clearDirty();
  state.files = state.files.filter(f => !f.checked);

  if (state.files.length === 0) {
    showEmpty();
  } else {
    renderFileList();
    updateTagFields();
  }
});

// ---- Open link (empty state) ----

document.getElementById('open-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const paths = await window.minid3.openFilesDialog();
  if (paths.length > 0) await addFiles(paths);
});

// ---- Drop on empty state (click on drop-zone) ----
document.getElementById('drop-zone').addEventListener('click', async (e) => {
  if (e.target.id === 'open-link') return; // handled above
  const paths = await window.minid3.openFilesDialog();
  if (paths.length > 0) await addFiles(paths);
});

// ---- Drag and drop ----

let dragDepth = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  if (dragDepth === 1) {
    if (editorStateEl.classList.contains('hidden')) {
      emptyStateEl.classList.add('drag-active');
      emptyOverlay.classList.remove('hidden');
    } else {
      editorOverlay.classList.remove('hidden');
    }
  }
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth === 0) {
    emptyStateEl.classList.remove('drag-active');
    emptyOverlay.classList.add('hidden');
    editorOverlay.classList.add('hidden');
  }
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  emptyStateEl.classList.remove('drag-active');
  emptyOverlay.classList.add('hidden');
  editorOverlay.classList.add('hidden');

  const paths = Array.from(e.dataTransfer.files)
    .map(f => window.minid3.getPathForFile(f))
    .filter(Boolean);
  if (paths.length > 0) await addFiles(paths);
});

// ---- Files opened from OS (macOS open-file, Windows/Linux via main process) ----

window.minid3.onFilesOpened(async (paths) => {
  await addFiles(paths);
});
