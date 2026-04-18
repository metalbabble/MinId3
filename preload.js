const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('minid3', {
  openFilesDialog: () => ipcRenderer.invoke('open-files-dialog'),
  openArtDialog: () => ipcRenderer.invoke('open-art-dialog'),
  resolvePaths: (paths) => ipcRenderer.invoke('resolve-paths', paths),
  readTags: (filePaths) => ipcRenderer.invoke('read-tags', filePaths),
  writeTags: (filePaths, updates) => ipcRenderer.invoke('write-tags', filePaths, updates),
  removeTags: (filePaths) => ipcRenderer.invoke('remove-tags', filePaths),
  onFilesOpened: (cb) => ipcRenderer.on('files-opened', (_e, paths) => cb(paths)),
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
