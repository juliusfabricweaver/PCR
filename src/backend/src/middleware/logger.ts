import { Request, Response, NextFunction } from 'express';
import db from '../database';
import { AuthenticatedRequest } from './auth';

export const logActivity = (action: string, resourceType?: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function(data) {
      // Log activity after successful response
      if (res.statusCode < 400 && req.user) {
        try {
          const resourceId = req.params.id || req.body?.id || null;

          db.prepare(`
            INSERT INTO activity_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            generateId(),
            req.user.id,
            action,
            resourceType || null,
            resourceId,
            JSON.stringify({
              method: req.method,
              url: req.url,
              statusCode: res.statusCode
            }),
            req.ip,
            req.headers['user-agent'] || null
          );
        } catch (error) {
          console.error('Failed to log activity:', error);
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

// Simple ID generator
function generateId(): string {
  return 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}