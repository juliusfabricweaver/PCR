import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database';

const JWT_SECRET = process.env.JWT_SECRET || 'pcr-dev-secret-key';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log('Auth middleware - Request path:', req.path, 'URL:', req.url);
  console.log('Auth middleware - Auth header:', req.headers['authorization']);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  console.log('Auth middleware - Token (first 50 chars):', token.substring(0, 50) + '...');

  try {
    console.log('Auth middleware - Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('Auth middleware - Token decoded successfully, userId:', decoded.userId);

    // Verify user still exists and is active
    const user = db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(decoded.userId) as any;

    if (!user || !user.is_active) {
      console.log('Auth middleware - User not found or inactive');
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    console.log('Auth middleware - User authenticated successfully:', user.username);
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
    console.log('Auth middleware - Token verification failed:', error.message);
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    next();
  };
};