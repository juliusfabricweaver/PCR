import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to the renderer process
 * This is the secure bridge between the renderer and main process
 */
const electronAPI = {
  /**
   * Get the backend server port
   */
  getServerPort: (): Promise<number> => {
    return ipcRenderer.invoke('get-server-port');
  },

  /**
   * Get the application data path
   */
  getDataPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-data-path');
  },

  /**
   * Get the application version
   */
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-version');
  },

  /**
   * Save a file using native dialog
   */
  saveFile: (data: { content: string; defaultName: string }): Promise<{ success: boolean; path?: string; error?: string } | null> => {
    return ipcRenderer.invoke('save-file', data);
  },

  /**
   * Open a file using native dialog
   */
  openFile: (): Promise<{ success: boolean; content?: string; path?: string; error?: string } | null> => {
    return ipcRenderer.invoke('open-file');
  },

  /**
   * Print a PCR report
   */
  printPCR: (pcrId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('print-pcr', pcrId);
  },

  /**
   * Window controls
   */
  minimizeWindow: (): void => {
    ipcRenderer.send('minimize-window');
  },

  maximizeWindow: (): void => {
    ipcRenderer.send('maximize-window');
  },

  closeWindow: (): void => {
    ipcRenderer.send('close-window');
  },

  /**
   * Check if running in Electron
   */
  isElectron: true,
};

// Type definition for the exposed API
export type ElectronAPI = typeof electronAPI;

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Also expose a simple flag to detect Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
