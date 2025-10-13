/**
 * Type definitions for Electron API exposed to renderer process
 */

export interface ElectronAPI {
  /**
   * Get the backend server port
   */
  getServerPort: () => Promise<number>;

  /**
   * Get the application data path
   */
  getDataPath: () => Promise<string>;

  /**
   * Get the application version
   */
  getVersion: () => Promise<string>;

  /**
   * Save a file using native dialog
   */
  saveFile: (data: {
    content: string;
    defaultName: string;
  }) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  } | null>;

  /**
   * Open a file using native dialog
   */
  openFile: () => Promise<{
    success: boolean;
    content?: string;
    path?: string;
    error?: string;
  } | null>;

  /**
   * Print a PCR report
   */
  printPCR: (pcrId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  /**
   * Window controls
   */
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;

  /**
   * Check if running in Electron
   */
  isElectron: boolean;
}

/**
 * Augment the global Window interface to include Electron API
 */
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    isElectron?: boolean;
  }
}

export {};
