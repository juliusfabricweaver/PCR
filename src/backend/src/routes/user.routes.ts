/**
 * User management routes
 */

import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.middleware';
import { validate, userSchemas } from '../middleware/validation.middleware';

export function createUserRoutes(userController: UserController): Router {
  const router = Router();

  // All user routes require authentication
  router.use(requireAuth);

  /**
   * @route GET /api/users
   * @desc Get all users (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/',
    requireAdmin,
    validate(userSchemas.list),
    userController.getAllUsers
  );

  /**
   * @route POST /api/users
   * @desc Create new user (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/',
    requireAdmin,
    validate(userSchemas.create),
    userController.createUser
  );

  /**
   * @route GET /api/users/summary
   * @desc Get users summary (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/summary',
    requireAdmin,
    userController.getUsersSummary
  );

  /**
   * @route GET /api/users/:id
   * @desc Get user by ID (self or admin)
   * @access Private
   */
  router.get(
    '/:id',
    validate(userSchemas.getById),
    requireSelfOrAdmin('id'),
    userController.getUserById
  );

  /**
   * @route PUT /api/users/:id
   * @desc Update user (self limited fields or admin)
   * @access Private
   */
  router.put(
    '/:id',
    validate(userSchemas.update),
    requireSelfOrAdmin('id'),
    userController.updateUser
  );

  /**
   * @route DELETE /api/users/:id
   * @desc Delete user (admin only)
   * @access Private (Admin)
   */
  router.delete(
    '/:id',
    requireAdmin,
    validate(userSchemas.delete),
    userController.deleteUser
  );

  /**
   * @route GET /api/users/:id/stats
   * @desc Get user statistics (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/:id/stats',
    requireAdmin,
    validate(userSchemas.getById),
    userController.getUserStats
  );

  /**
   * @route POST /api/users/:id/reset-password
   * @desc Reset user password (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/:id/reset-password',
    requireAdmin,
    validate({
      params: userSchemas.getById.params,
      body: {
        newPassword: require('joi').string().min(8).required()
      }
    }),
    userController.resetUserPassword
  );

  return router;
}