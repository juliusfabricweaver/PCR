import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { ChildProcess, fork } from 'child_process';
import * as fs from 'fs';

// Environment detection
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let serverPort: number = 0;

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    title: 'PCR Application',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Start the Express backend server
 */
async function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = isDev
      ? path.join(__dirname, '../../src/backend/src/index.ts')
      : path.join(process.resourcesPath, 'app.asar.unpacked/dist/backend/backend/src/index.js');

    // Check if backend file exists
    if (!fs.existsSync(backendPath)) {
      console.error(`Backend file not found: ${backendPath}`);
      reject(new Error(`Backend file not found: ${backendPath}`));
      return;
    }

    // Set environment variables for backend
    const env = {
      ...process.env,
      IS_ELECTRON: 'true',
      NODE_ENV: isDev ? 'development' : 'production',
      DATABASE_PATH: path.join(app.getPath('userData'), 'pcr_database.db'),
    };

    // Fork the backend process
    if (isDev) {
      // In development, use ts-node to run TypeScript directly
      backendProcess = fork(backendPath, [], {
        env,
        execArgv: ['-r', 'ts-node/register', '--transpile-only'],
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      });
    } else {
      // In production, run compiled JavaScript
      backendProcess = fork(backendPath, [], {
        env,
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      });
    }

    // Listen for server ready message
    backendProcess.on('message', (message: any) => {
      if (message.type === 'server-ready') {
        serverPort = message.port;
        console.log(`Backend server started on port ${serverPort}`);
        resolve();
      }
    });

    // Handle backend process errors
    backendProcess.on('error', (error) => {
      console.error('Backend process error:', error);
      reject(error);
    });

    // Handle backend process exit
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
      backendProcess = null;
    });

    // Timeout if backend doesn't start in 30 seconds
    setTimeout(() => {
      if (serverPort === 0) {
        reject(new Error('Backend server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

/**
 * Stop the backend server
 */
function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// IPC Handlers

/**
 * Get the server port for the frontend to connect to
 */
ipcMain.handle('get-server-port', () => {
  return serverPort;
});

/**
 * Get the data path where database is stored
 */
ipcMain.handle('get-data-path', () => {
  return app.getPath('userData');
});

/**
 * Get application version
 */
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

/**
 * Save file dialog
 */
ipcMain.handle('save-file', async (_event, data: { content: string; defaultName: string }) => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: data.defaultName,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, data.content, 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  return null;
});

/**
 * Open file dialog
 */
ipcMain.handle('open-file', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, content, path: result.filePaths[0] };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  return null;
});

/**
 * Print PCR
 */
ipcMain.handle('print-pcr', async (_event, _pcrId: string) => {
  if (!mainWindow) return { success: false, error: 'No window available' };

  try {
    await mainWindow.webContents.print({});
    return { success: true };
  } catch (error) {
    console.error('Error printing:', error);
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Window controls
 */
ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

// App lifecycle events

/**
 * App ready - start backend and create window
 */
app.whenReady().then(async () => {
  try {
    console.log('Starting backend server...');
    await startBackend();
    console.log('Creating main window...');
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * All windows closed - quit app (except on macOS)
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

/**
 * App is quitting - cleanup
 */
app.on('before-quit', () => {
  stopBackend();
});

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
