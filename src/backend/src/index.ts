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
import './database';
import { cleanupService } from './services/cleanup';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PCR API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);

  // Start cleanup service
  cleanupService.start();
});

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