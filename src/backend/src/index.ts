/**
 * PCR Application Backend Server
 * Main entry point for the secure backend API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

// Import services and configuration
import { loadConfiguration, getEnvironmentConfig } from './config/index';
import { DatabaseService } from './database/database.service';
import { AuthenticationService } from './services/auth.service';
import { EncryptionService } from './services/encryption.service';
import { logger } from './services/logger';

// Import middleware
import { 
  setupErrorHandling,
  timeoutHandler
} from './middleware/error.middleware';
import { 
  requestId,
  securityHeaders,
  corsForNWjs,
  trackActivity
} from './middleware/auth.middleware';
import { sanitizeInput } from './middleware/validation.middleware';

// Import routes
import { createApiRoutes } from './routes';

class PCRServer {
  private app: express.Application;
  private server: any;
  private dbService!: DatabaseService;
  private authService!: AuthenticationService;
  private encryptionService!: EncryptionService;
  private config: any;

  constructor() {
    this.app = express();
    this.setupServer();
  }

  private async setupServer(): Promise<void> {
    try {
      // Load configuration
      logger.info('Loading configuration...');
      const configResult = loadConfiguration();
      this.config = configResult.config;
      
      logger.configLoaded('Server configuration loaded');

      // Initialize services
      await this.initializeServices(
        configResult.adminUsername,
        configResult.adminPassword,
        configResult.encryptionPassword
      );

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('Server setup completed successfully');

    } catch (error) {
      logger.error('Server setup failed', error);
      process.exit(1);
    }
  }

  private async initializeServices(
    adminUsername: string,
    adminPassword: string,
    encryptionPassword: string
  ): Promise<void> {
    try {
      // Initialize database service
      logger.info('Initializing database service...');
      this.dbService = new DatabaseService(this.config.database);
      await this.dbService.connect();

      // Seed admin user
      await this.dbService.seedData(adminUsername, adminPassword);

      // Initialize encryption service
      logger.info('Initializing encryption service...');
      this.encryptionService = new EncryptionService(
        this.config.encryption,
        encryptionPassword
      );

      // Test encryption
      const encryptionTest = await this.encryptionService.testEncryption();
      if (!encryptionTest) {
        throw new Error('Encryption service test failed');
      }

      // Initialize authentication service
      logger.info('Initializing authentication service...');
      this.authService = new AuthenticationService(this.dbService, {
        jwtSecret: this.config.jwt.secret,
        jwtExpiresIn: this.config.jwt.expiresIn,
        refreshSecret: this.config.jwt.refreshSecret,
        refreshExpiresIn: this.config.jwt.refreshExpiresIn,
        bcryptRounds: this.config.security.bcryptRounds,
        maxLoginAttempts: this.config.security.maxLoginAttempts,
        lockoutDuration: this.config.security.lockoutDuration,
        sessionTimeout: this.config.session.timeout
      });

      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Service initialization failed', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    const envConfig = getEnvironmentConfig();

    // Request ID middleware (first)
    this.app.use(requestId());

    // Security headers
    this.app.use(securityHeaders());

    // Helmet for additional security
    this.app.use(helmet(envConfig.helmet));

    // Trust proxy if configured
    if (envConfig.trustProxy) {
      this.app.set('trust proxy', 1);
    }

    // CORS configuration
    if (envConfig.corsOrigin) {
      this.app.use(cors({
        origin: envConfig.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID']
      }));
    } else {
      // NW.js CORS handling
      this.app.use(corsForNWjs());
    }

    // Request timeout
    this.app.use(timeoutHandler(30000)); // 30 seconds

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Input sanitization
    this.app.use(sanitizeInput());

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.httpRequest(req, res, duration);
      });
      
      next();
    });

    // Activity tracking for authenticated requests
    this.app.use(trackActivity(this.authService));

    logger.info('Middleware setup completed');
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createApiRoutes(
      this.dbService,
      this.authService,
      this.encryptionService,
      this.config
    ));

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        success: true,
        message: 'PCR Application Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    // Catch-all for undefined routes (handled by error middleware)
    this.app.use('*', (req, res, _next) => {
      res.status(404).json({
        success: false,
        error: {
          name: 'NotFoundError',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    });

    logger.info('Routes setup completed');
  }

  private setupErrorHandling(): void {
    setupErrorHandling(this.app);
    logger.info('Error handling setup completed');
  }

  public async start(): Promise<void> {
    try {
      const port = this.config.port;
      const host = this.config.host;

      this.server = createServer(this.app);

      // Graceful shutdown handling
      const gracefulShutdown = async (signal: string) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        if (this.server) {
          this.server.close(async () => {
            logger.info('HTTP server closed');
            
            // Close database connections
            if (this.dbService) {
              await this.dbService.close();
            }
            
            // Close logger
            await logger.close();
            
            process.exit(0);
          });

          // Force close after 10 seconds
          setTimeout(() => {
            logger.error('Force closing server after timeout');
            process.exit(1);
          }, 10000);
        }
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Start server
      this.server.listen(port, host, () => {
        logger.systemStart();
        logger.info(`🚀 PCR Backend Server started successfully`, {
          port,
          host,
          environment: this.config.nodeEnv,
          pid: process.pid
        });

        // Schedule periodic cleanup
        this.scheduleCleanupTasks();
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
        } else {
          logger.error('Server error occurred', error);
        }
        process.exit(1);
      });

    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  private scheduleCleanupTasks(): void {
    // Clean expired sessions and drafts every hour
    setInterval(async () => {
      try {
        await this.dbService.cleanupExpired();
        logger.debug('Scheduled cleanup completed');
      } catch (error) {
        logger.error('Scheduled cleanup failed', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Database optimization every 6 hours
    setInterval(async () => {
      try {
        await this.dbService.run('PRAGMA optimize');
        logger.debug('Database optimization completed');
      } catch (error) {
        logger.error('Database optimization failed', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    logger.info('Cleanup tasks scheduled');
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(async () => {
          if (this.dbService) {
            await this.dbService.close();
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new PCRServer();
  server.start().catch((error) => {
    logger.error('Failed to start PCR server', error);
    process.exit(1);
  });
}

export { PCRServer };
export default PCRServer;