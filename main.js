const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const NodeID3 = require('node-id3');

let mainWindow = null;
const pendingFiles = [];

// Single instance lock (Windows/Linux)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const files = parseFilesFromArgv(argv);
      if (files.length > 0) {
        mainWindow.webContents.send('files-opened', files);
      }
    }
  });
}

function parseFilesFromArgv(argv) {
  const startIdx = app.isPackaged ? 1 : 2;
  return argv.slice(startIdx).filter(p => {
    if (!path.isAbsolute(p)) return false;
    try {
      const stat = fs.statSync(p);
      return stat.isDirectory() || p.toLowerCase().endsWith('.mp3');
    } catch {
      return false;
    }
  });
}

// macOS: handle open-file events (drag to dock icon, double-click in Finder)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('files-opened', [filePath]);
  } else {
    pendingFiles.push(filePath);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    title: 'MinId3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    const startupFiles = [...pendingFiles, ...parseFilesFromArgv(process.argv)];
    if (startupFiles.length > 0) {
      mainWindow.webContents.send('files-opened', startupFiles);
      pendingFiles.length = 0;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// ---- IPC Handlers ----

ipcMain.handle('open-files-dialog', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'MP3 Files', extensions: ['mp3'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('open-art-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
    ],
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/jpeg';
    return { filePath, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  } catch {
    return null;
  }
});

function getMp3FilesFromDir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.mp3'))
      .map(e => path.join(dirPath, e.name))
      .sort();
  } catch {
    return [];
  }
}

ipcMain.handle('resolve-paths', async (_event, paths) => {
  const result = [];
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        result.push(...getMp3FilesFromDir(p));
      } else if (p.toLowerCase().endsWith('.mp3')) {
        result.push(p);
      }
    } catch { /* skip inaccessible paths */ }
  }
  return result;
});

ipcMain.handle('read-tags', async (_event, filePaths) => {
  return filePaths.map(filePath => {
    try {
      const tags = NodeID3.read(filePath);
      const entry = {
        filePath,
        title: tags.title || '',
        artist: tags.artist || '',
        album: tags.album || '',
        year: tags.year || '',
        trackNumber: tags.trackNumber || '',
        genre: tags.genre || '',
        comment: tags.comment?.text || '',
        image: null,
      };
      if (tags.image?.imageBuffer) {
        const mime = tags.image.mime || 'image/jpeg';
        entry.image = `data:${mime};base64,${tags.image.imageBuffer.toString('base64')}`;
      }
      return entry;
    } catch (e) {
      return {
        filePath, error: String(e),
        title: '', artist: '', album: '', year: '',
        trackNumber: '', genre: '', comment: '', image: null,
      };
    }
  });
});

ipcMain.handle('write-tags', async (_event, filePaths, updates) => {
  const errors = [];

  const nodeId3Tags = {};
  if ('title' in updates) nodeId3Tags.title = updates.title;
  if ('artist' in updates) nodeId3Tags.artist = updates.artist;
  if ('album' in updates) nodeId3Tags.album = updates.album;
  if ('year' in updates) nodeId3Tags.year = updates.year;
  if ('trackNumber' in updates) nodeId3Tags.trackNumber = updates.trackNumber;
  if ('genre' in updates) nodeId3Tags.genre = updates.genre;
  if ('comment' in updates) nodeId3Tags.comment = { language: 'eng', text: updates.comment };

  if (updates.artFilePath) {
    try {
      const buffer = fs.readFileSync(updates.artFilePath);
      const ext = path.extname(updates.artFilePath).toLowerCase().slice(1);
      const mimeMap = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
      };
      nodeId3Tags.image = {
        mime: mimeMap[ext] || 'image/jpeg',
        type: { id: 3, name: 'Front Cover' },
        description: 'Cover',
        imageBuffer: buffer,
      };
    } catch (e) {
      errors.push({ filePath: updates.artFilePath, error: `Failed to read art: ${e.message}` });
    }
  }

  for (const filePath of filePaths) {
    try {
      const result = NodeID3.update(nodeId3Tags, filePath);
      if (result !== true) {
        errors.push({ filePath, error: `Write returned: ${result}` });
      }
    } catch (e) {
      errors.push({ filePath, error: String(e) });
    }
  }

  return { success: errors.length === 0, errors };
});

ipcMain.handle('remove-tags', async (_event, filePaths) => {
  const errors = [];
  for (const filePath of filePaths) {
    try {
      const result = NodeID3.removeTags(filePath);
      if (result !== true) {
        errors.push({ filePath, error: `Remove returned: ${result}` });
      }
    } catch (e) {
      errors.push({ filePath, error: String(e) });
    }
  }
  return { success: errors.length === 0, errors };
});
