const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess;

// Check if backend is available
function checkBackendHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Wait for backend to be ready
async function waitForBackend(maxAttempts = 30) {
  console.log('Waiting for backend to be ready...');

  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkBackendHealth();

    if (isReady) {
      console.log('Backend is ready!');
      return true;
    }

    console.log(`Backend not ready yet, attempt ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.error('Backend failed to start');
  return false;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    const indexPath = path.join(__dirname, '..', 'dist', 'frontend', 'index.html');
    console.log('Loading production build from:', indexPath);

    mainWindow.loadFile(indexPath);

    // Enable DevTools in production for debugging
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startBackend() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    console.log('Backend should be started separately in development mode');
    return true;
  }

  console.log('Starting backend in production mode...');

  // Use the compiled JavaScript backend in production
  const backendPath = path.join(__dirname, '..', 'dist', 'backend', 'index.js');

  // Check if backend file exists
  const fs = require('fs');
  if (!fs.existsSync(backendPath)) {
    console.error('Backend file not found at:', backendPath);
    return false;
  }

  console.log('Starting backend from:', backendPath);

  // Start backend process
  backendProcess = spawn('node', [backendPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3000'
    },
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Log backend output
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data.toString()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data.toString()}`);
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  // Wait for backend to be ready
  const isReady = await waitForBackend();

  if (!isReady) {
    console.error('Backend failed to become ready');
  }

  return isReady;
}

app.whenReady().then(async () => {
  const backendStarted = await startBackend();

  if (!backendStarted) {
    console.error('Failed to start backend, but continuing anyway...');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    console.log('Killing backend process...');
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    console.log('Killing backend process before quit...');
    backendProcess.kill();
  }
});

// Menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Report',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-new-report');
          }
        }
      },
      {
        label: 'Save Draft',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-save-draft');
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About PCR Application',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-about');
          }
        }
      }
    ]
  }
];

if (process.platform === 'darwin') {
  menuTemplate.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services', submenu: [] },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  });
}

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);