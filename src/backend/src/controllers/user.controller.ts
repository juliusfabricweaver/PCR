/**
 * User management controller
 */

import { Request, Response } from 'express';
import { AuthenticationService } from '../services/auth.service';
import { DatabaseService } from '../database/database.service';
import { logger } from '../services/logger';
import { 
  NotFoundError,
  ValidationError,
  ConflictError,
  AuthorizationError 
} from '../utils/errors';
import { User, UserCreateData, ApiResponse, PaginatedResponse } from '../types';
import { asyncHandler } from '../middleware/error.middleware';

export class UserController {
  constructor(
    private authService: AuthenticationService,
    private dbService: DatabaseService
  ) {}

  /**
   * Get all users (admin only)
   */
  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const sortBy = req.query.sortBy as string || 'created_at';
    const sortOrder = req.query.sortOrder as string || 'DESC';
    const offset = (page - 1) * limit;

    // Validate sort field to prevent SQL injection
    const allowedSortFields = ['id', 'username', 'role', 'created_at', 'updated_at'];
    if (!allowedSortFields.includes(sortBy)) {
      throw new ValidationError(`Invalid sort field: ${sortBy}`);
    }

    const users = await this.dbService.query<User>(`
      SELECT id, username, role, created_at, updated_at
      FROM users
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM users
    `);

    logger.audit('Users list requested', req.user?.id, {
      page,
      limit,
      sortBy,
      sortOrder,
      totalUsers: totalCount?.count || 0
    });

    const response: ApiResponse<PaginatedResponse<User>> = {
      success: true,
      data: {
        items: users,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Get user by ID
   */
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);

    if (!userId) {
      throw new ValidationError('Invalid user ID');
    }

    const user = await this.authService.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Remove password hash from response
    const { password_hash, ...userResponse } = user;

    logger.audit('User details requested', req.user?.id, {
      targetUserId: userId,
      targetUsername: user.username
    });

    const response: ApiResponse<Omit<User, 'password_hash'>> = {
      success: true,
      data: userResponse
    };

    res.json(response);
  });

  /**
   * Create new user (admin only)
   */
  createUser = asyncHandler(async (req: Request, res: Response) => {
    const { username, password, role }: UserCreateData = req.body;

    // Validate password strength
    const crypto = await import('crypto');
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check if username already exists
    const existingUser = await this.dbService.findOne<User>('users', {
      where: { username }
    });

    if (existingUser) {
      throw new ConflictError(`User with username '${username}' already exists`);
    }

    // Create user
    const newUser = await this.authService.createUser(
      { username, password, role },
      req.user?.id
    );

    // Remove password hash from response
    const { password_hash, ...userResponse } = newUser;

    logger.security('User created', {
      createdUserId: newUser.id,
      createdUsername: username,
      createdRole: role,
      createdBy: req.user?.username,
      createdById: req.user?.id
    });

    const response: ApiResponse<Omit<User, 'password_hash'>> = {
      success: true,
      data: userResponse,
      message: `User '${username}' created successfully`
    };

    res.status(201).json(response);
  });

  /**
   * Update user (admin only, or user updating themselves - limited fields)
   */
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { username, role } = req.body;

    if (!userId) {
      throw new ValidationError('Invalid user ID');
    }

    // Get existing user
    const existingUser = await this.authService.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError('User', userId);
    }

    // Check permissions
    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id === userId;

    if (!isAdmin && !isSelf) {
      throw new AuthorizationError('Can only update own profile or must be admin');
    }

    // Non-admin users can only update their own username
    if (!isAdmin && role !== undefined) {
      throw new AuthorizationError('Cannot change role - admin privileges required');
    }

    // Check for username conflicts if username is being changed
    if (username && username !== existingUser.username) {
      const conflictUser = await this.dbService.findOne<User>('users', {
        where: { username }
      });

      if (conflictUser) {
        throw new ConflictError(`Username '${username}' is already taken`);
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (username && username !== existingUser.username) {
      updates.push('username = ?');
      params.push(username);
    }

    if (role && role !== existingUser.role && isAdmin) {
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    // Execute update
    await this.dbService.run(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated user
    const updatedUser = await this.authService.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    // Remove password hash from response
    const { password_hash, ...userResponse } = updatedUser;

    logger.security('User updated', {
      updatedUserId: userId,
      updatedUsername: updatedUser.username,
      updatedBy: req.user?.username,
      updatedById: req.user?.id,
      changes: { username, role }
    });

    const response: ApiResponse<Omit<User, 'password_hash'>> = {
      success: true,
      data: userResponse,
      message: 'User updated successfully'
    };

    res.json(response);
  });

  /**
   * Delete user (admin only)
   */
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);

    if (!userId) {
      throw new ValidationError('Invalid user ID');
    }

    // Cannot delete yourself
    if (req.user?.id === userId) {
      throw new ValidationError('Cannot delete your own account');
    }

    // Get user before deletion for logging
    const userToDelete = await this.authService.getUserById(userId);
    if (!userToDelete) {
      throw new NotFoundError('User', userId);
    }

    // Delete user (this will cascade delete related data)
    const success = await this.authService.deleteUser(userId, req.user?.id!);

    if (!success) {
      throw new Error('Failed to delete user');
    }

    logger.security('User deleted', {
      deletedUserId: userId,
      deletedUsername: userToDelete.username,
      deletedRole: userToDelete.role,
      deletedBy: req.user?.username,
      deletedById: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      message: `User '${userToDelete.username}' deleted successfully`
    };

    res.json(response);
  });

  /**
   * Get user statistics (admin only)
   */
  getUserStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);

    if (!userId) {
      throw new ValidationError('Invalid user ID');
    }

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Get user statistics
    const stats = await this.dbService.query(`
      SELECT 
        (SELECT COUNT(*) FROM drafts WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP) as active_drafts,
        (SELECT COUNT(*) FROM submissions WHERE user_id = ?) as total_submissions,
        (SELECT COUNT(*) FROM logs WHERE user_id = ?) as total_logs,
        (SELECT MAX(timestamp) FROM logs WHERE user_id = ? AND action = 'login') as last_login,
        (SELECT COUNT(*) FROM login_attempts WHERE username = ? AND success = 1) as successful_logins,
        (SELECT COUNT(*) FROM login_attempts WHERE username = ? AND success = 0) as failed_logins
    `, [userId, userId, userId, userId, user.username, user.username]);

    const userStats = stats[0] || {};

    logger.audit('User stats requested', req.user?.id, {
      targetUserId: userId,
      targetUsername: user.username
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: user.created_at
        },
        stats: userStats
      }
    };

    res.json(response);
  });

  /**
   * Get users summary (admin only) - lightweight version for dashboards
   */
  getUsersSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.dbService.query(`
      SELECT 
        role,
        COUNT(*) as count,
        COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as recent_count
      FROM users 
      GROUP BY role
    `);

    const totalUsers = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM users
    `);

    const activeUsers = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM sessions 
      WHERE expires_at > CURRENT_TIMESTAMP
    `);

    logger.audit('Users summary requested', req.user?.id);

    const response: ApiResponse = {
      success: true,
      data: {
        total: totalUsers?.count || 0,
        active: activeUsers?.count || 0,
        byRole: summary.reduce((acc: any, item: any) => {
          acc[item.role] = {
            count: item.count,
            recentCount: item.recent_count
          };
          return acc;
        }, {})
      }
    };

    res.json(response);
  });

  /**
   * Reset user password (admin only)
   */
  resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!userId) {
      throw new ValidationError('Invalid user ID');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Hash new password
    const hashedPassword = await this.authService.hashPassword(newPassword);

    // Update password in database
    await this.dbService.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );

    // Invalidate all sessions for this user
    await this.dbService.run('DELETE FROM sessions WHERE user_id = ?', [userId]);

    logger.security('Password reset by admin', {
      targetUserId: userId,
      targetUsername: user.username,
      resetBy: req.user?.username,
      resetById: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      message: `Password reset for user '${user.username}'. All sessions have been terminated.`
    };

    res.json(response);
  });
}