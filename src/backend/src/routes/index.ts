/**
 * Main routes configuration
 */

import { Router } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthenticationService } from '../services/auth.service';
import { EncryptionService } from '../services/encryption.service';
import { BackupService } from '../utils/backup';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { AppConfig } from '../types';

// Import controllers
import { AuthController } from '../controllers/auth.controller';
import { UserController } from '../controllers/user.controller';
import { DraftController } from '../controllers/draft.controller';
import { SubmissionController } from '../controllers/submission.controller';
import { LogController } from '../controllers/log.controller';

// Import routes
import { createAuthRoutes } from './auth.routes';
import { createUserRoutes } from './user.routes';
import { createDraftRoutes } from './draft.routes';
import { createSubmissionRoutes } from './submission.routes';
import { createLogRoutes } from './log.routes';

export function createApiRoutes(
  dbService: DatabaseService,
  authService: AuthenticationService,
  encryptionService: EncryptionService,
  config: AppConfig
): Router {
  const router = Router();

  // Initialize controllers
  const authController = new AuthController(authService, dbService);
  const userController = new UserController(authService, dbService);
  const draftController = new DraftController(dbService, encryptionService);
  const submissionController = new SubmissionController(dbService);
  const logController = new LogController(dbService);
  const backupService = new BackupService(dbService);

  // API health check
  router.get('/health', async (req, res) => {
    try {
      // Check database connection
      const dbConnected = dbService.isDBConnected();
      
      // Get basic stats
      const stats = dbConnected ? await dbService.getStats() : null;
      
      // Check encryption service
      const encryptionWorking = await encryptionService.testEncryption();

      const healthStatus = {
        status: dbConnected && encryptionWorking ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: {
            status: dbConnected ? 'connected' : 'disconnected',
            stats
          },
          encryption: {
            status: encryptionWorking ? 'working' : 'failed'
          },
          authentication: {
            status: 'ready',
            activeSessions: authService.getActiveSessionCount()
          }
        }
      };

      res.status(dbConnected && encryptionWorking ? 200 : 503).json({
        success: true,
        data: healthStatus
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  });

  // API info endpoint
  router.get('/info', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'PCR Application API',
        version: '1.0.0',
        environment: config.nodeEnv,
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          drafts: '/api/drafts',
          submissions: '/api/submissions',
          logs: '/api/logs'
        },
        features: [
          'User authentication with JWT',
          'Role-based access control',
          'Encrypted draft storage',
          'Form submissions',
          'Audit logging',
          'Database backup/restore'
        ]
      }
    });
  });

  // Mount route modules
  router.use('/auth', createAuthRoutes(authController));
  router.use('/users', createUserRoutes(userController));
  router.use('/drafts', createDraftRoutes(draftController));
  router.use('/submissions', createSubmissionRoutes(submissionController));
  router.use('/logs', createLogRoutes(logController));

  // Admin-only backup endpoints
  router.post('/backup', 
    requireAuth(authService), 
    requireAdmin,
    async (req, res) => {
      try {
        const options = {
          includeData: req.body.includeData !== false,
          compress: req.body.compress !== false,
          destination: req.body.destination || './backups'
        };

        const backupInfo = await backupService.createBackup(options);

        res.json({
          success: true,
          data: backupInfo,
          message: 'Backup created successfully'
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Backup failed',
          message: error.message
        });
      }
    }
  );

  router.get('/backups',
    requireAuth(authService),
    requireAdmin,
    async (req, res) => {
      try {
        const backupDirectory = req.query.directory as string || './backups';
        const backups = await backupService.listBackups(backupDirectory);

        res.json({
          success: true,
          data: backups
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to list backups',
          message: error.message
        });
      }
    }
  );

  router.post('/restore',
    requireAuth(authService),
    requireAdmin,
    async (req, res) => {
      try {
        const options = {
          source: req.body.source,
          overwrite: req.body.overwrite === true
        };

        if (!options.source) {
          return res.status(400).json({
            success: false,
            error: 'Backup source file is required'
          });
        }

        await backupService.restoreBackup(options);

        res.json({
          success: true,
          message: 'Database restored successfully'
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Restore failed',
          message: error.message
        });
      }
    }
  );

  return router;
}