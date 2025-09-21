const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-new-report', callback);
    ipcRenderer.on('menu-save-draft', callback);
    ipcRenderer.on('menu-about', callback);
  },
  removeMenuListener: () => {
    ipcRenderer.removeAllListeners('menu-new-report');
    ipcRenderer.removeAllListeners('menu-save-draft');
    ipcRenderer.removeAllListeners('menu-about');
  }
});