/**
 * Authentication routes
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth, requireAdmin, authRateLimit } from '../middleware/auth.middleware';
import { validate, authSchemas } from '../middleware/validation.middleware';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Apply rate limiting to all auth routes
  router.use(authRateLimit());

  /**
   * @route POST /api/auth/login
   * @desc User login
   * @access Public
   */
  router.post(
    '/login',
    validate(authSchemas.login),
    authController.login
  );

  /**
   * @route POST /api/auth/logout
   * @desc User logout
   * @access Private
   */
  router.post(
    '/logout',
    requireAuth,
    authController.logout
  );

  /**
   * @route GET /api/auth/validate
   * @desc Validate current token/session
   * @access Private
   */
  router.get(
    '/validate',
    requireAuth,
    authController.validate
  );

  /**
   * @route POST /api/auth/refresh
   * @desc Refresh access token
   * @access Public
   */
  router.post(
    '/refresh',
    validate(authSchemas.refreshToken),
    authController.refreshToken
  );

  /**
   * @route POST /api/auth/change-password
   * @desc Change user password
   * @access Private
   */
  router.post(
    '/change-password',
    requireAuth,
    validate(authSchemas.changePassword),
    authController.changePassword
  );

  /**
   * @route GET /api/auth/profile
   * @desc Get current user profile
   * @access Private
   */
  router.get(
    '/profile',
    requireAuth,
    authController.getProfile
  );

  /**
   * @route GET /api/auth/sessions
   * @desc Get user sessions
   * @access Private
   */
  router.get(
    '/sessions',
    requireAuth,
    authController.getSessions
  );

  /**
   * @route GET /api/auth/stats
   * @desc Get authentication statistics (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/stats',
    requireAuth,
    requireAdmin,
    authController.getAuthStats
  );

  /**
   * @route GET /api/auth/login-attempts
   * @desc Get login attempts (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/login-attempts',
    requireAuth,
    requireAdmin,
    authController.getLoginAttempts
  );

  /**
   * @route POST /api/auth/unlock/:username
   * @desc Unlock user account (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/unlock/:username',
    requireAuth,
    requireAdmin,
    authController.unlockAccount
  );

  /**
   * @route POST /api/auth/force-logout/:userId
   * @desc Force logout all sessions for a user (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/force-logout/:userId',
    requireAuth,
    requireAdmin,
    authController.forceLogoutUser
  );

  return router;
}