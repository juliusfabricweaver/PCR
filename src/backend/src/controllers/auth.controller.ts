/**
 * Authentication controller handling login, logout, and token management
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../services/auth.service';
import { DatabaseService } from '../database/database.service';
import { logger } from '../services/logger';
import { 
  AuthenticationError,
  ValidationError,
  RateLimitError 
} from '../utils/errors';
import { LoginRequest, ApiResponse, LoginResponse } from '../types';
import { asyncHandler } from '../middleware/error.middleware';

export class AuthController {
  constructor(
    private authService: AuthenticationService,
    private dbService: DatabaseService
  ) {}

  /**
   * User login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password }: LoginRequest = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    logger.info('Login attempt', { username, ipAddress, userAgent });

    const loginResult = await this.authService.login(
      { username, password },
      ipAddress,
      userAgent
    );

    if (!loginResult.success) {
      logger.security('Login failed', {
        username,
        reason: loginResult.message,
        ipAddress,
        userAgent
      });

      throw new AuthenticationError(loginResult.message || 'Login failed');
    }

    logger.security('Login successful', {
      username,
      userId: loginResult.user?.id,
      ipAddress,
      userAgent
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResult
    };

    res.json(response);
  });

  /**
   * User logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.substring(7);
    const sessionId = req.headers['x-session-id'] as string;

    if (!token) {
      throw new AuthenticationError('Token required for logout');
    }

    const success = await this.authService.logout(token, sessionId);

    logger.info('Logout completed', {
      userId: req.user?.id,
      username: req.user?.username,
      sessionId: sessionId || 'unknown',
      success
    });

    const response: ApiResponse = {
      success: true,
      message: 'Logged out successfully'
    };

    res.json(response);
  });

  /**
   * Validate current session/token
   */
  validate = asyncHandler(async (req: Request, res: Response) => {
    // If we reach here, the auth middleware has already validated the token
    const sessionId = req.headers['x-session-id'] as string;
    let sessionValid = false;

    if (sessionId && req.user) {
      const session = await this.authService.validateSession(sessionId);
      sessionValid = !!session;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        valid: true,
        user: req.user,
        sessionValid,
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  });

  /**
   * Refresh access token using refresh token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const result = await this.authService.refreshToken(refreshToken);

    if (!result) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    logger.debug('Token refreshed successfully', {
      userId: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      data: {
        accessToken: result.accessToken
      }
    };

    res.json(response);
  });

  /**
   * Change user password
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    const success = await this.authService.updatePassword(
      userId,
      currentPassword,
      newPassword
    );

    if (!success) {
      throw new AuthenticationError('Failed to update password');
    }

    logger.security('Password changed', {
      userId,
      username: req.user?.username
    });

    const response: ApiResponse = {
      success: true,
      message: 'Password updated successfully'
    };

    res.json(response);
  });

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    const user = await this.authService.getUserById(userId);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Remove sensitive data
    const { password_hash, ...userProfile } = user;

    const response: ApiResponse = {
      success: true,
      data: userProfile
    };

    res.json(response);
  });

  /**
   * Get user sessions (for session management)
   */
  getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    const sessions = this.authService.getUserSessions(userId);

    const response: ApiResponse = {
      success: true,
      data: {
        activeSessions: sessions.length,
        sessions: sessions.map(session => ({
          userId: session.userId,
          username: session.username,
          loginTime: session.loginTime,
          lastActivity: session.lastActivity
        }))
      }
    };

    res.json(response);
  });

  /**
   * Get authentication statistics (admin only)
   */
  getAuthStats = asyncHandler(async (req: Request, res: Response) => {
    // Get active sessions count
    const activeSessionCount = this.authService.getActiveSessionCount();

    // Get recent login attempts from database
    const recentLogins = await this.dbService.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_logins,
        COUNT(CASE WHEN success = 0 THEN 1 END) as failed_attempts
      FROM login_attempts 
      WHERE attempted_at > datetime('now', '-24 hours')
    `);

    // Get locked accounts
    const lockedAccounts = await this.dbService.query(`
      SELECT COUNT(DISTINCT username) as locked_count
      FROM login_attempts 
      WHERE locked_until > datetime('now')
    `);

    // Get user count by role
    const userStats = await this.dbService.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users 
      GROUP BY role
    `);

    const stats = {
      activeSessions: activeSessionCount,
      last24Hours: recentLogins[0] || { total_attempts: 0, successful_logins: 0, failed_attempts: 0 },
      lockedAccounts: lockedAccounts[0]?.locked_count || 0,
      usersByRole: userStats.reduce((acc: any, stat: any) => {
        acc[stat.role] = stat.count;
        return acc;
      }, {})
    };

    logger.audit('Auth stats requested', req.user?.id, {
      requestedBy: req.user?.username,
      stats
    });

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.json(response);
  });

  /**
   * Get recent login attempts (admin only)
   */
  getLoginAttempts = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const attempts = await this.dbService.query(`
      SELECT 
        la.username,
        la.ip_address,
        la.success,
        la.attempted_at,
        la.locked_until,
        u.id as user_id,
        u.role
      FROM login_attempts la
      LEFT JOIN users u ON la.username = u.username
      ORDER BY la.attempted_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM login_attempts
    `);

    logger.audit('Login attempts requested', req.user?.id, {
      requestedBy: req.user?.username,
      page,
      limit
    });

    const response: ApiResponse = {
      success: true,
      data: {
        attempts,
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          pages: Math.ceil((totalCount?.count || 0) / limit)
        }
      }
    };

    res.json(response);
  });

  /**
   * Unlock a user account (admin only)
   */
  unlockAccount = asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    if (!username) {
      throw new ValidationError('Username is required');
    }

    // Clear login attempts for this username
    await this.dbService.run(`
      DELETE FROM login_attempts 
      WHERE username = ? AND locked_until > datetime('now')
    `, [username]);

    // Also clear from memory (if using in-memory tracking)
    // This would require access to the auth service's internal state
    // For now, we'll just clear the database records

    logger.security('Account unlocked by admin', {
      unlockedUsername: username,
      unlockedBy: req.user?.username,
      adminId: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      message: `Account ${username} has been unlocked`
    };

    res.json(response);
  });

  /**
   * Force logout all sessions for a user (admin only)
   */
  forceLogoutUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const targetUserId = parseInt(userId);

    if (!targetUserId) {
      throw new ValidationError('Valid user ID is required');
    }

    // Get target user info
    const targetUser = await this.authService.getUserById(targetUserId);
    if (!targetUser) {
      throw new ValidationError('User not found');
    }

    // Remove all sessions for this user
    await this.dbService.run('DELETE FROM sessions WHERE user_id = ?', [targetUserId]);

    logger.security('User force logged out by admin', {
      targetUserId,
      targetUsername: targetUser.username,
      adminId: req.user?.id,
      adminUsername: req.user?.username
    });

    const response: ApiResponse = {
      success: true,
      message: `All sessions for user ${targetUser.username} have been terminated`
    };

    res.json(response);
  });
}