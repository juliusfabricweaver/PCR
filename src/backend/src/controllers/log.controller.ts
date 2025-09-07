/**
 * Log controller for audit trail and system monitoring
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { logger } from '../services/logger';
import { 
  ValidationError,
  AuthorizationError 
} from '../utils/errors';
import { Log, ApiResponse, PaginatedResponse, LogAction } from '../types';
import { asyncHandler } from '../middleware/error.middleware';

export class LogController {
  constructor(private dbService: DatabaseService) {}

  /**
   * Get logs with filtering and pagination (admin only)
   */
  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
    const action = req.query.action as LogAction;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND l.user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND l.action = ?';
      params.push(action);
    }

    if (dateFrom) {
      whereClause += ' AND l.timestamp >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND l.timestamp <= ?';
      params.push(dateTo);
    }

    params.push(limit, offset);

    const logs = await this.dbService.query<any>(`
      SELECT 
        l.id,
        l.user_id,
        u.username,
        l.action,
        l.timestamp,
        l.details,
        l.ip_address,
        l.user_agent
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.timestamp DESC
      LIMIT ? OFFSET ?
    `, params);

    const countParams = params.slice(0, -2); // Remove limit and offset
    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
    `, countParams);

    // Parse JSON details for each log entry
    const processedLogs = logs.map(log => ({
      ...log,
      details: log.details ? (() => {
        try {
          return JSON.parse(log.details);
        } catch {
          return log.details;
        }
      })() : null
    }));

    logger.audit('Logs accessed', req.user?.id, {
      filters: { userId, action, dateFrom, dateTo },
      page,
      limit,
      resultCount: logs.length
    });

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: processedLogs,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Get logs for current user
   */
  getUserLogs = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const action = req.query.action as LogAction;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE l.user_id = ?';
    const params: any[] = [userId];

    if (action) {
      whereClause += ' AND l.action = ?';
      params.push(action);
    }

    if (dateFrom) {
      whereClause += ' AND l.timestamp >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND l.timestamp <= ?';
      params.push(dateTo);
    }

    params.push(limit, offset);

    const logs = await this.dbService.query<any>(`
      SELECT 
        l.id,
        l.action,
        l.timestamp,
        l.details
      FROM logs l
      ${whereClause}
      ORDER BY l.timestamp DESC
      LIMIT ? OFFSET ?
    `, params);

    const countParams = params.slice(0, -2);
    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM logs l
      ${whereClause}
    `, countParams);

    // Process logs (parse details, filter sensitive info)
    const processedLogs = logs.map(log => ({
      ...log,
      details: log.details ? (() => {
        try {
          const details = JSON.parse(log.details);
          // Remove sensitive information from user's own logs
          if (details.password) delete details.password;
          if (details.token) delete details.token;
          return details;
        } catch {
          return null;
        }
      })() : null
    }));

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: processedLogs,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Get log statistics (admin only)
   */
  getLogStats = asyncHandler(async (req: Request, res: Response) => {
    const timeframe = req.query.timeframe as string || '24h';
    
    let timeClause = "datetime('now', '-24 hours')";
    switch (timeframe) {
      case '1h':
        timeClause = "datetime('now', '-1 hour')";
        break;
      case '24h':
        timeClause = "datetime('now', '-24 hours')";
        break;
      case '7d':
        timeClause = "datetime('now', '-7 days')";
        break;
      case '30d':
        timeClause = "datetime('now', '-30 days')";
        break;
    }

    // Overall statistics
    const overallStats = await this.dbService.queryOne<any>(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN timestamp > ${timeClause} THEN 1 END) as recent_logs,
        COUNT(DISTINCT user_id) as active_users,
        MIN(timestamp) as earliest_log,
        MAX(timestamp) as latest_log
      FROM logs
    `);

    // Activity by action type
    const actionStats = await this.dbService.query<any>(`
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(CASE WHEN timestamp > ${timeClause} THEN 1 END) as recent_count
      FROM logs
      GROUP BY action
      ORDER BY count DESC
    `);

    // Activity by user (top 10)
    const userStats = await this.dbService.query<any>(`
      SELECT 
        u.username,
        COUNT(l.id) as log_count,
        COUNT(CASE WHEN l.timestamp > ${timeClause} THEN 1 END) as recent_count,
        MAX(l.timestamp) as last_activity
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.user_id IS NOT NULL
      GROUP BY l.user_id, u.username
      ORDER BY log_count DESC
      LIMIT 10
    `);

    // Hourly activity (last 24 hours)
    const hourlyStats = await this.dbService.query<any>(`
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as count
      FROM logs
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY strftime('%H', timestamp)
      ORDER BY hour
    `);

    // Security events
    const securityStats = await this.dbService.query<any>(`
      SELECT 
        action,
        COUNT(*) as count
      FROM logs
      WHERE action IN ('failed_login', 'account_locked', 'session_expired')
        AND timestamp > ${timeClause}
      GROUP BY action
    `);

    logger.audit('Log statistics requested', req.user?.id, {
      timeframe
    });

    const response: ApiResponse = {
      success: true,
      data: {
        timeframe,
        overall: overallStats || {},
        byAction: actionStats,
        byUser: userStats,
        hourlyActivity: hourlyStats,
        securityEvents: securityStats
      }
    };

    res.json(response);
  });

  /**
   * Get recent activity (simplified view for dashboards)
   */
  getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const isAdmin = req.user?.role === 'admin';
    const userId = isAdmin ? null : req.user?.id!;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (!isAdmin) {
      whereClause += ' AND l.user_id = ?';
      params.push(userId);
    }

    params.push(limit);

    const recentLogs = await this.dbService.query<any>(`
      SELECT 
        l.id,
        l.user_id,
        u.username,
        l.action,
        l.timestamp,
        CASE 
          WHEN l.details IS NOT NULL THEN 
            CASE 
              WHEN l.action = 'form_submitted' THEN JSON_EXTRACT(l.details, '$.patient_name')
              WHEN l.action = 'draft_saved' THEN 'Draft saved'
              WHEN l.action = 'user_created' THEN JSON_EXTRACT(l.details, '$.created_username')
              ELSE NULL
            END
          ELSE NULL
        END as summary
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.timestamp DESC
      LIMIT ?
    `, params);

    const response: ApiResponse = {
      success: true,
      data: {
        activities: recentLogs,
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  });

  /**
   * Export logs as CSV (admin only)
   */
  exportLogs = asyncHandler(async (req: Request, res: Response) => {
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const action = req.query.action as LogAction;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND l.user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND l.action = ?';
      params.push(action);
    }

    if (dateFrom) {
      whereClause += ' AND l.timestamp >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND l.timestamp <= ?';
      params.push(dateTo);
    }

    const logs = await this.dbService.query<any>(`
      SELECT 
        l.id,
        l.user_id,
        u.username,
        l.action,
        l.timestamp,
        l.details,
        l.ip_address,
        l.user_agent
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.timestamp DESC
      LIMIT 10000
    `, params);

    // Create CSV content
    const csvRows = [
      'ID,User ID,Username,Action,Timestamp,Details,IP Address,User Agent'
    ];

    for (const log of logs) {
      const details = log.details ? log.details.replace(/"/g, '""') : '';
      const userAgent = log.user_agent ? log.user_agent.replace(/"/g, '""') : '';
      
      const row = [
        log.id,
        log.user_id || '',
        `"${log.username || ''}"`,
        log.action,
        log.timestamp,
        `"${details}"`,
        log.ip_address || '',
        `"${userAgent}"`
      ].join(',');
      
      csvRows.push(row);
    }

    const csv = csvRows.join('\n');

    logger.audit('Logs exported', req.user?.id, {
      count: logs.length,
      filters: { dateFrom, dateTo, action, userId }
    });

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=pcr-logs-${new Date().toISOString().split('T')[0]}.csv`
    });

    res.send(csv);
  });

  /**
   * Clean old logs (admin only)
   */
  cleanOldLogs = asyncHandler(async (req: Request, res: Response) => {
    const daysToKeep = parseInt(req.query.days as string) || 90;

    if (daysToKeep < 30) {
      throw new ValidationError('Must keep logs for at least 30 days');
    }

    const result = await this.dbService.run(`
      DELETE FROM logs 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `, [daysToKeep]);

    logger.security('Old logs cleaned', {
      deletedCount: result.changes,
      daysToKeep,
      cleanedBy: req.user?.username,
      cleanedById: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      data: {
        deletedCount: result.changes,
        daysToKeep
      },
      message: `Cleaned ${result.changes} log entries older than ${daysToKeep} days`
    };

    res.json(response);
  });

  /**
   * Get audit trail for a specific entity (admin only)
   */
  getAuditTrail = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;

    if (!entityType || !entityId) {
      throw new ValidationError('Entity type and ID are required');
    }

    // Build query based on entity type
    let whereClause = '';
    let params: any[] = [];

    switch (entityType.toLowerCase()) {
      case 'user':
        whereClause = `WHERE (l.user_id = ? OR JSON_EXTRACT(l.details, '$.created_user_id') = ? OR JSON_EXTRACT(l.details, '$.deleted_user_id') = ?)`;
        params = [entityId, entityId, entityId];
        break;
      case 'draft':
        whereClause = `WHERE JSON_EXTRACT(l.details, '$.draft_id') = ?`;
        params = [entityId];
        break;
      case 'submission':
        whereClause = `WHERE JSON_EXTRACT(l.details, '$.submission_id') = ?`;
        params = [entityId];
        break;
      default:
        throw new ValidationError(`Invalid entity type: ${entityType}`);
    }

    const auditLogs = await this.dbService.query<any>(`
      SELECT 
        l.id,
        l.user_id,
        u.username as actor,
        l.action,
        l.timestamp,
        l.details,
        l.ip_address
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.timestamp DESC
    `, params);

    // Process details
    const processedLogs = auditLogs.map(log => ({
      ...log,
      details: log.details ? (() => {
        try {
          return JSON.parse(log.details);
        } catch {
          return log.details;
        }
      })() : null
    }));

    logger.audit('Audit trail accessed', req.user?.id, {
      entityType,
      entityId,
      logCount: auditLogs.length
    });

    const response: ApiResponse = {
      success: true,
      data: {
        entityType,
        entityId,
        auditTrail: processedLogs
      }
    };

    res.json(response);
  });
}