/**
 * Authentication service with bcrypt, JWT, and session management
 * Implements secure authentication with rate limiting and account lockout
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { 
  User, 
  UserCreateData, 
  AuthPayload, 
  LoginRequest, 
  LoginResponse, 
  SessionData,
  LogAction 
} from '../types';
import { logger } from './logger';
import { AppConfig } from '../types';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in seconds
  sessionTimeout: number; // in seconds
}

export class AuthenticationService {
  private db: DatabaseService;
  private config: AuthConfig;
  private activeSessions: Map<string, SessionData> = new Map();
  private loginAttempts: Map<string, { count: number; lockedUntil?: Date }> = new Map();

  constructor(db: DatabaseService, config: AuthConfig) {
    this.db = db;
    this.config = config;
    
    // Cleanup expired sessions periodically
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Every minute
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.config.bcryptRounds);
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(payload, this.config.jwtSecret, {
        expiresIn: this.config.jwtExpiresIn,
        issuer: 'pcr-app',
        audience: 'pcr-users'
      });
    } catch (error) {
      logger.error('Access token generation failed:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(userId: number): string {
    try {
      return jwt.sign({ userId, type: 'refresh' }, this.config.refreshSecret, {
        expiresIn: this.config.refreshExpiresIn,
        issuer: 'pcr-app',
        audience: 'pcr-users'
      });
    } catch (error) {
      logger.error('Refresh token generation failed:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): AuthPayload | null {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: 'pcr-app',
        audience: 'pcr-users'
      }) as AuthPayload;
      
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid token');
      } else {
        logger.error('Token verification failed:', error);
      }
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: number } | null {
    try {
      const payload = jwt.verify(token, this.config.refreshSecret, {
        issuer: 'pcr-app',
        audience: 'pcr-users'
      }) as any;
      
      if (payload.type !== 'refresh') {
        return null;
      }
      
      return { userId: payload.userId };
    } catch (error) {
      logger.debug('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  private isAccountLocked(username: string): boolean {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) return false;

    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      return true;
    }

    // Clear expired lockout
    if (attempts.lockedUntil && attempts.lockedUntil <= new Date()) {
      attempts.lockedUntil = undefined;
      attempts.count = 0;
    }

    return false;
  }

  /**
   * Record failed login attempt
   */
  private recordFailedLogin(username: string, ipAddress?: string): void {
    const attempts = this.loginAttempts.get(username) || { count: 0 };
    attempts.count++;

    if (attempts.count >= this.config.maxLoginAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration * 1000);
      logger.warn(`Account locked for ${username} due to ${attempts.count} failed attempts`);
      
      // Log account lockout
      this.logActivity(0, 'account_locked', {
        username,
        attempts: attempts.count,
        locked_until: attempts.lockedUntil.toISOString(),
        ip_address: ipAddress
      });
    }

    this.loginAttempts.set(username, attempts);

    // Also record in database
    this.db.run(
      'INSERT INTO login_attempts (username, ip_address, success, attempted_at, locked_until) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
      [username, ipAddress || 'unknown', false, attempts.lockedUntil?.toISOString() || null]
    ).catch(error => {
      logger.error('Failed to record login attempt:', error);
    });
  }

  /**
   * Clear failed login attempts on successful login
   */
  private clearFailedLogins(username: string, ipAddress?: string): void {
    this.loginAttempts.delete(username);
    
    // Record successful login attempt
    this.db.run(
      'INSERT INTO login_attempts (username, ip_address, success, attempted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [username, ipAddress || 'unknown', true]
    ).catch(error => {
      logger.error('Failed to record successful login attempt:', error);
    });
  }

  /**
   * Authenticate user with username and password
   */
  async login(credentials: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { username, password } = credentials;

    try {
      // Check if account is locked
      if (this.isAccountLocked(username)) {
        const attempts = this.loginAttempts.get(username);
        const lockedUntil = attempts?.lockedUntil;
        
        await this.logActivity(0, 'failed_login', {
          username,
          reason: 'account_locked',
          locked_until: lockedUntil?.toISOString(),
          ip_address: ipAddress
        });

        return {
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts'
        };
      }

      // Find user by username
      const user = await this.db.findOne<User>('users', {
        where: { username }
      });

      if (!user) {
        this.recordFailedLogin(username, ipAddress);
        
        await this.logActivity(0, 'failed_login', {
          username,
          reason: 'user_not_found',
          ip_address: ipAddress
        });

        return {
          success: false,
          message: 'Invalid username or password'
        };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        this.recordFailedLogin(username, ipAddress);
        
        await this.logActivity(user.id, 'failed_login', {
          reason: 'invalid_password',
          ip_address: ipAddress
        });

        return {
          success: false,
          message: 'Invalid username or password'
        };
      }

      // Clear failed login attempts
      this.clearFailedLogins(username, ipAddress);

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      const refreshToken = this.generateRefreshToken(user.id);

      // Create session
      const sessionId = uuidv4();
      const sessionData: SessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        loginTime: new Date(),
        lastActivity: new Date(),
        loginAttempts: 0
      };

      this.activeSessions.set(sessionId, sessionData);

      // Store session in database
      await this.db.run(
        `INSERT INTO sessions (id, user_id, data, created_at, expires_at, last_activity)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+' || ? || ' seconds'), CURRENT_TIMESTAMP)`,
        [sessionId, user.id, JSON.stringify(sessionData), this.config.sessionTimeout]
      );

      // Log successful login
      await this.logActivity(user.id, 'login', {
        session_id: sessionId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info(`User ${username} logged in successfully`, { userId: user.id, sessionId });

      return {
        success: true,
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };

    } catch (error) {
      logger.error('Login process failed:', error);
      return {
        success: false,
        message: 'Login failed due to internal error'
      };
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string, sessionId?: string): Promise<boolean> {
    try {
      const payload = this.verifyToken(token);
      if (!payload) return false;

      // Remove from active sessions
      if (sessionId) {
        this.activeSessions.delete(sessionId);
        
        // Remove from database
        await this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
      } else {
        // Remove all sessions for user
        for (const [id, session] of this.activeSessions) {
          if (session.userId === payload.userId) {
            this.activeSessions.delete(id);
          }
        }
        
        await this.db.run('DELETE FROM sessions WHERE user_id = ?', [payload.userId]);
      }

      // Log logout
      await this.logActivity(payload.userId, 'logout', {
        session_id: sessionId
      });

      logger.info(`User ${payload.username} logged out`, { userId: payload.userId });
      return true;

    } catch (error) {
      logger.error('Logout failed:', error);
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      if (!payload) return null;

      const user = await this.db.findOne<User>('users', {
        where: { id: payload.userId }
      });

      if (!user) return null;

      const newAccessToken = this.generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      return { accessToken: newAccessToken };

    } catch (error) {
      logger.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Validate session and update last activity
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        // Try to load from database
        const dbSession = await this.db.findOne<any>('sessions', {
          where: { id: sessionId }
        });

        if (!dbSession || new Date(dbSession.expires_at) < new Date()) {
          return null;
        }

        const sessionData = JSON.parse(dbSession.data) as SessionData;
        sessionData.lastActivity = new Date();
        this.activeSessions.set(sessionId, sessionData);
        return sessionData;
      }

      // Check if session expired
      const sessionAge = Date.now() - session.lastActivity.getTime();
      if (sessionAge > this.config.sessionTimeout * 1000) {
        this.activeSessions.delete(sessionId);
        await this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
        
        await this.logActivity(session.userId, 'session_expired', {
          session_id: sessionId,
          session_age_seconds: Math.floor(sessionAge / 1000)
        });

        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      this.activeSessions.set(sessionId, session);

      // Update in database
      await this.db.run(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
        [sessionId]
      );

      return session;

    } catch (error) {
      logger.error('Session validation failed:', error);
      return null;
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData: UserCreateData, createdBy?: number): Promise<User> {
    try {
      // Check if username already exists
      const existingUser = await this.db.findOne<User>('users', {
        where: { username: userData.username }
      });

      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Insert user
      const result = await this.db.run(
        `INSERT INTO users (username, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userData.username, hashedPassword, userData.role]
      );

      // Log user creation
      await this.logActivity(createdBy || result.lastID, 'user_created', {
        created_user_id: result.lastID,
        created_username: userData.username,
        created_role: userData.role,
        created_by: createdBy || 'self'
      });

      // Fetch and return the created user
      const user = await this.db.findOne<User>('users', {
        where: { id: result.lastID }
      });

      if (!user) {
        throw new Error('Failed to retrieve created user');
      }

      logger.info(`User created: ${userData.username}`, { userId: user.id, role: user.role });
      return user;

    } catch (error) {
      logger.error('User creation failed:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: number, deletedBy: number): Promise<boolean> {
    try {
      const user = await this.db.findOne<User>('users', {
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Don't allow deletion of admin users by non-admin users
      const deletedByUser = await this.db.findOne<User>('users', {
        where: { id: deletedBy }
      });

      if (user.role === 'admin' && deletedByUser?.role !== 'admin') {
        throw new Error('Cannot delete admin user');
      }

      // Remove user and all associated data (cascading delete)
      await this.db.run('DELETE FROM users WHERE id = ?', [userId]);

      // Remove all sessions for this user
      for (const [sessionId, session] of this.activeSessions) {
        if (session.userId === userId) {
          this.activeSessions.delete(sessionId);
        }
      }

      // Log user deletion
      await this.logActivity(deletedBy, 'user_deleted', {
        deleted_user_id: userId,
        deleted_username: user.username,
        deleted_role: user.role
      });

      logger.info(`User deleted: ${user.username}`, { userId, deletedBy });
      return true;

    } catch (error) {
      logger.error('User deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<User | null> {
    return this.db.findOne<User>('users', {
      where: { id: userId }
    });
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    return this.db.find<User>('users', {
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.db.findOne<User>('users', {
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await this.db.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId]
      );

      logger.info(`Password updated for user: ${user.username}`, { userId });
      return true;

    } catch (error) {
      logger.error('Password update failed:', error);
      throw error;
    }
  }

  /**
   * Log user activity
   */
  private async logActivity(userId: number, action: LogAction, details?: any): Promise<void> {
    try {
      await this.db.run(
        'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
        [userId, action, details ? JSON.stringify(details) : null]
      );
    } catch (error) {
      logger.error('Failed to log activity:', error);
    }
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      const sessionAge = now - session.lastActivity.getTime();
      if (sessionAge > this.config.sessionTimeout * 1000) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        this.activeSessions.delete(sessionId);
        this.logActivity(session.userId, 'session_expired', { session_id: sessionId });
      }
    });

    if (expiredSessions.length > 0) {
      logger.debug(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get user session info
   */
  getUserSessions(userId: number): SessionData[] {
    const sessions: SessionData[] = [];
    
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }

    return sessions;
  }
}