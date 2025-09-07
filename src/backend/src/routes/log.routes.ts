/**
 * Log and audit routes
 */

import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validate, logSchemas } from '../middleware/validation.middleware';

export function createLogRoutes(logController: LogController): Router {
  const router = Router();

  // All log routes require authentication
  router.use(requireAuth);

  /**
   * @route GET /api/logs
   * @desc Get logs with filtering (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/',
    requireAdmin,
    validate(logSchemas.list),
    logController.getLogs
  );

  /**
   * @route GET /api/logs/user
   * @desc Get current user's logs
   * @access Private
   */
  router.get(
    '/user',
    validate(logSchemas.list),
    logController.getUserLogs
  );

  /**
   * @route GET /api/logs/stats
   * @desc Get log statistics (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/stats',
    requireAdmin,
    logController.getLogStats
  );

  /**
   * @route GET /api/logs/recent
   * @desc Get recent activity
   * @access Private
   */
  router.get(
    '/recent',
    logController.getRecentActivity
  );

  /**
   * @route GET /api/logs/export
   * @desc Export logs as CSV (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/export',
    requireAdmin,
    logController.exportLogs
  );

  /**
   * @route POST /api/logs/cleanup
   * @desc Clean old logs (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/cleanup',
    requireAdmin,
    logController.cleanOldLogs
  );

  /**
   * @route GET /api/logs/audit/:entityType/:entityId
   * @desc Get audit trail for specific entity (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/audit/:entityType/:entityId',
    requireAdmin,
    validate({
      params: require('joi').object({
        entityType: require('joi').string().valid('user', 'draft', 'submission').required(),
        entityId: require('joi').string().required()
      })
    }),
    logController.getAuditTrail
  );

  return router;
}