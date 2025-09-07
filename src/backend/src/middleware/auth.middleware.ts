/**
 * Authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../services/auth.service';
import { 
  AuthenticationError, 
  AuthorizationError, 
  TokenExpiredError,
  SessionExpiredError 
} from '../utils/errors';
import { logger } from '../services/logger';

// Extend Request interface to include user and session data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: 'admin' | 'user';
      };
      sessionId?: string;
      requestId?: string;
    }
  }
}

// Authentication middleware
export function requireAuth(authService: AuthenticationService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const sessionId = req.headers['x-session-id'] as string;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Authorization token required');
      }

      const token = authHeader.substring(7);
      const payload = authService.verifyToken(token);

      if (!payload) {
        throw new TokenExpiredError('Invalid or expired token');
      }

      // Validate session if session ID provided
      if (sessionId) {
        const session = await authService.validateSession(sessionId);
        if (!session) {
          throw new SessionExpiredError('Session has expired');
        }

        // Ensure session matches token
        if (session.userId !== payload.userId) {
          throw new AuthenticationError('Session and token mismatch');
        }

        req.sessionId = sessionId;
      }

      // Attach user data to request
      req.user = {
        id: payload.userId,
        username: payload.username,
        role: payload.role
      };

      // Log successful authentication
      logger.debug('User authenticated successfully', {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        sessionId: sessionId || 'none'
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Role-based authorization middleware
export function requireRole(...allowedRoles: ('admin' | 'user')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.security('Authorization failed - insufficient privileges', {
          userId: req.user.id,
          username: req.user.username,
          role: req.user.role,
          requiredRoles: allowedRoles,
          path: req.originalUrl,
          method: req.method
        });

        throw new AuthorizationError('Insufficient privileges');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Admin-only middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next);
}

// Self-access or admin middleware (user can access own data, admin can access any)
export function requireSelfOrAdmin(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const targetUserId = parseInt(req.params[userIdParam]);
      const isAdmin = req.user.role === 'admin';
      const isSelf = req.user.id === targetUserId;

      if (!isAdmin && !isSelf) {
        logger.security('Authorization failed - not self or admin', {
          userId: req.user.id,
          targetUserId,
          role: req.user.role,
          path: req.originalUrl
        });

        throw new AuthorizationError('Access denied - can only access own data');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Optional authentication middleware (doesn't fail if no token)
export function optionalAuth(authService: AuthenticationService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No token, continue without authentication
      }

      const token = authHeader.substring(7);
      const payload = authService.verifyToken(token);

      if (payload) {
        req.user = {
          id: payload.userId,
          username: payload.username,
          role: payload.role
        };

        // Validate session if session ID provided
        const sessionId = req.headers['x-session-id'] as string;
        if (sessionId) {
          const session = await authService.validateSession(sessionId);
          if (session && session.userId === payload.userId) {
            req.sessionId = sessionId;
          }
        }
      }

      next();
    } catch (error) {
      // In optional auth, we don't fail on token errors
      logger.debug('Optional auth failed, continuing without authentication', {
        error: error.message
      });
      next();
    }
  };
}

// Rate limiting middleware for authentication endpoints
export function authRateLimit() {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  const maxAttempts = 10;
  const windowMs = 15 * 60 * 1000; // 15 minutes

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const now = Date.now();

    // Clean up expired entries
    for (const [ip, data] of attempts.entries()) {
      if (now > data.resetTime) {
        attempts.delete(ip);
      }
    }

    // Get current attempts for this IP
    let attemptData = attempts.get(key);
    if (!attemptData || now > attemptData.resetTime) {
      attemptData = { count: 0, resetTime: now + windowMs };
      attempts.set(key, attemptData);
    }

    // Check if limit exceeded
    if (attemptData.count >= maxAttempts) {
      logger.security('Auth rate limit exceeded', {
        ip: req.ip,
        attempts: attemptData.count,
        resetTime: new Date(attemptData.resetTime).toISOString()
      });

      return res.status(429).json({
        success: false,
        error: {
          name: 'RateLimitError',
          message: 'Too many authentication attempts',
          statusCode: 429,
          retryAfter: Math.ceil((attemptData.resetTime - now) / 1000)
        }
      });
    }

    // Increment attempt count
    attemptData.count++;

    next();
  };
}

// Request ID middleware
export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    req.requestId = require('uuid').v4();
    res.set('X-Request-ID', req.requestId);
    next();
  };
}

// Security headers middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Remove server signature
    res.removeHeader('X-Powered-By');
    
    // Security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    });

    next();
  };
}

// CORS middleware for NW.js
export function corsForNWjs() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow requests from NW.js app
    const origin = req.get('Origin');
    
    if (!origin || origin.startsWith('file://') || origin.startsWith('chrome-extension://')) {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID, X-Request-ID',
        'Access-Control-Expose-Headers': 'X-Request-ID',
        'Access-Control-Max-Age': '86400' // 24 hours
      });
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
}

// Session activity tracking middleware
export function trackActivity(authService: AuthenticationService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Update session activity if user is authenticated
      if (req.user && req.sessionId) {
        await authService.validateSession(req.sessionId);
      }
      next();
    } catch (error) {
      // Don't fail the request if session tracking fails
      logger.debug('Session activity tracking failed', { error: error.message });
      next();
    }
  };
}