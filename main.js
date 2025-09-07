const path = require('path')
const { spawn } = require('child_process')

// Security configuration for NW.js
nw.Window.get().on('new-win-policy', (frame, url, policy) => {
  // Block external URLs from opening in new windows
  if (!url.startsWith('http://localhost:') && !url.startsWith('file://')) {
    policy.ignore()
  }
})

// Development mode detection
const isDevelopment = process.env.NODE_ENV === 'development'

let backendProcess = null

// Start backend server in development
if (isDevelopment) {
  const backendPath = path.join(__dirname, 'src', 'backend', 'server.ts')
  
  try {
    // Use nodemon for development
    backendProcess = spawn('npx', ['nodemon', backendPath], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    })

    backendProcess.on('error', (error) => {
      console.error('Backend process error:', error)
    })

    backendProcess.on('exit', (code) => {
      console.log(`Backend process exited with code ${code}`)
    })
  } catch (error) {
    console.error('Failed to start backend process:', error)
  }
}

// Application lifecycle management
nw.App.on('open', () => {
  console.log('PCR Application started')
})

nw.App.on('reopen', () => {
  // Show window when app is reopened (macOS)
  nw.Window.get().show()
})

// Clean shutdown
process.on('exit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})

process.on('SIGINT', () => {
  if (backendProcess) {
    backendProcess.kill('SIGINT')
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
  }
  process.exit(0)
})

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // In production, you might want to restart the app or show an error dialog
  if (!isDevelopment) {
    nw.App.quit()
  }
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Window configuration
const mainWindow = nw.Window.get()

// Set minimum window size
mainWindow.setMinimumSize(800, 600)

// Center window on screen
mainWindow.setPosition('center')

// Prevent context menu in production
if (!isDevelopment) {
  mainWindow.on('loaded', () => {
    mainWindow.eval(null, `
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      });
    `)
  })
}

// Enable developer tools in development
if (isDevelopment) {
  mainWindow.showDevTools()
}

// Security headers
nw.Window.get().on('document-start', (frame) => {
  frame.executeScript({
    code: `
      // Disable eval and similar functions for security
      window.eval = function() {
        throw new Error('eval() is disabled for security reasons');
      };
      
      // Basic CSP enforcement
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* ws://localhost:*; img-src 'self' data: blob: http://localhost:*; font-src 'self' data: https://fonts.gstatic.com;";
      document.head.appendChild(meta);
    `
  })
})