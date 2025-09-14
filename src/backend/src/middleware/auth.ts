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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verify user still exists and is active
    const user = db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(decoded.userId) as any;

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
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