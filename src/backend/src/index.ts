import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import pcrRoutes from './routes/pcr';
import userRoutes from './routes/users';
import logsRoutes from './routes/logs';

// Import database to initialize
import { initDatabase } from './database';
import { cleanupService } from './services/cleanup';

const app = express();

// Electron environment detection
const isElectron = process.env.IS_ELECTRON === 'true';

// Use dynamic port in Electron (0 = random available port), fixed port otherwise
const PORT = isElectron ? 0 : (process.env.PORT || 3000);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS: Disable in Electron (not needed), enable for web
if (!isElectron) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers, null, 2)}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pcr', pcrRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logsRoutes);

// Special route for submissions to match frontend expectation
app.post('/api/submissions', (req, res, next) => {
  // Forward to PCR submit route
  req.url = '/submit';
  pcrRoutes(req, res, next);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'PCR API Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../../dist/frontend')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../dist/frontend/index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server (after database initialization)
async function startServer() {
  try {
    // Wait for database to initialize (sql.js is async)
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized');

    const server = app.listen(PORT, () => {
      const actualPort = (server.address() as any).port;
      console.log(`🚀 PCR API Server running on port ${actualPort}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${actualPort}/api/health`);

      // Notify Electron main process of server port if running in Electron
      if (isElectron && process.send) {
        process.send({ type: 'server-ready', port: actualPort });
      }

      // Start cleanup service
      cleanupService.start();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  cleanupService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  cleanupService.stop();
  process.exit(0);
});

export default app;