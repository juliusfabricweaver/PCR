/**
 * Submission controller for completed PCR forms
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { logger } from '../services/logger';
import { 
  NotFoundError,
  ValidationError,
  AuthorizationError 
} from '../utils/errors';
import { Submission, SubmissionData, ApiResponse, PaginatedResponse } from '../types';
import { asyncHandler } from '../middleware/error.middleware';

export class SubmissionController {
  constructor(private dbService: DatabaseService) {}

  /**
   * Create a new submission
   */
  createSubmission = asyncHandler(async (req: Request, res: Response) => {
    const { data } = req.body;
    const userId = req.user?.id!;

    if (!data || typeof data !== 'object') {
      throw new ValidationError('Submission data is required and must be an object');
    }

    // Store submission data as JSON
    const result = await this.dbService.run(`
      INSERT INTO submissions (user_id, data, submitted_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [userId, JSON.stringify(data)]);

    // Log the submission
    await this.dbService.run(
      'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
      [
        userId,
        'form_submitted',
        JSON.stringify({
          submission_id: result.lastID,
          data_size: JSON.stringify(data).length,
          patient_name: data.patientName || 'Unknown',
          incident_date: data.incidentDate || null
        })
      ]
    );

    // Clean up any drafts for this user (optional - form has been submitted)
    await this.dbService.run('DELETE FROM drafts WHERE user_id = ?', [userId]);

    logger.info('Form submitted', {
      userId,
      submissionId: result.lastID,
      dataSize: JSON.stringify(data).length,
      patientName: data.patientName || 'Unknown'
    });

    const response: ApiResponse = {
      success: true,
      data: {
        id: result.lastID,
        userId,
        submittedAt: new Date().toISOString()
      },
      message: 'Form submitted successfully'
    };

    res.status(201).json(response);
  });

  /**
   * Get a specific submission by ID
   */
  getSubmission = asyncHandler(async (req: Request, res: Response) => {
    const submissionId = parseInt(req.params.id);
    const userId = req.user?.id!;
    const isAdmin = req.user?.role === 'admin';

    if (!submissionId) {
      throw new ValidationError('Invalid submission ID');
    }

    let whereClause = 'WHERE s.id = ?';
    const params = [submissionId];

    // Non-admin users can only see their own submissions
    if (!isAdmin) {
      whereClause += ' AND s.user_id = ?';
      params.push(userId);
    }

    const submission = await this.dbService.queryOne<any>(`
      SELECT 
        s.id,
        s.user_id,
        u.username,
        s.data,
        s.submitted_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      ${whereClause}
    `, params);

    if (!submission) {
      throw new NotFoundError('Submission', submissionId);
    }

    // Parse JSON data
    let parsedData;
    try {
      parsedData = JSON.parse(submission.data);
    } catch (error) {
      logger.error('Failed to parse submission data', error, { submissionId });
      throw new Error('Corrupted submission data');
    }

    logger.audit('Submission accessed', userId, {
      submissionId,
      submissionUserId: submission.user_id,
      submissionUsername: submission.username
    });

    const response: ApiResponse = {
      success: true,
      data: {
        id: submission.id,
        userId: submission.user_id,
        username: submission.username,
        data: parsedData,
        submittedAt: submission.submitted_at
      }
    };

    res.json(response);
  });

  /**
   * Get submissions for current user
   */
  getUserSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE s.user_id = ?';
    const params = [userId];

    if (dateFrom) {
      whereClause += ' AND s.submitted_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND s.submitted_at <= ?';
      params.push(dateTo);
    }

    params.push(limit, offset);

    const submissions = await this.dbService.query<any>(`
      SELECT 
        s.id,
        s.submitted_at,
        JSON_EXTRACT(s.data, '$.patientName') as patient_name,
        JSON_EXTRACT(s.data, '$.incidentDate') as incident_date,
        JSON_EXTRACT(s.data, '$.chiefComplaint') as chief_complaint
      FROM submissions s
      ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?
    `, params);

    const countParams = params.slice(0, -2); // Remove limit and offset
    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM submissions s
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `, countParams);

    logger.debug('User submissions requested', {
      userId,
      count: submissions.length,
      page,
      limit,
      dateFilter: { dateFrom, dateTo }
    });

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: submissions,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Get all submissions (admin only)
   */
  getAllSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND s.user_id = ?';
      params.push(userId);
    }

    if (dateFrom) {
      whereClause += ' AND s.submitted_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND s.submitted_at <= ?';
      params.push(dateTo);
    }

    params.push(limit, offset);

    const submissions = await this.dbService.query<any>(`
      SELECT 
        s.id,
        s.user_id,
        u.username,
        s.submitted_at,
        JSON_EXTRACT(s.data, '$.patientName') as patient_name,
        JSON_EXTRACT(s.data, '$.incidentDate') as incident_date,
        JSON_EXTRACT(s.data, '$.chiefComplaint') as chief_complaint,
        LENGTH(s.data) as data_size
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?
    `, params);

    const countParams = params.slice(0, -2); // Remove limit and offset
    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      ${whereClause}
    `, countParams);

    logger.audit('All submissions requested', req.user?.id, {
      filterUserId: userId,
      dateFilter: { dateFrom, dateTo },
      page,
      limit,
      totalCount: totalCount?.count || 0
    });

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: submissions,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Delete a submission (admin only or own submission within time limit)
   */
  deleteSubmission = asyncHandler(async (req: Request, res: Response) => {
    const submissionId = parseInt(req.params.id);
    const userId = req.user?.id!;
    const isAdmin = req.user?.role === 'admin';

    if (!submissionId) {
      throw new ValidationError('Invalid submission ID');
    }

    // Get submission details
    const submission = await this.dbService.queryOne<any>(`
      SELECT 
        s.*,
        u.username,
        (julianday('now') - julianday(s.submitted_at)) * 24 as hours_since_submission
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [submissionId]);

    if (!submission) {
      throw new NotFoundError('Submission', submissionId);
    }

    // Check permissions
    if (!isAdmin) {
      // User can only delete their own submissions
      if (submission.user_id !== userId) {
        throw new AuthorizationError('Can only delete your own submissions');
      }

      // User can only delete within 1 hour of submission
      if (submission.hours_since_submission > 1) {
        throw new AuthorizationError('Can only delete submissions within 1 hour of submission');
      }
    }

    // Delete the submission
    const result = await this.dbService.run('DELETE FROM submissions WHERE id = ?', [submissionId]);

    if (result.changes === 0) {
      throw new NotFoundError('Submission', submissionId);
    }

    // Log the deletion
    await this.dbService.run(
      'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
      [
        userId,
        'form_cleared',
        JSON.stringify({
          submission_id: submissionId,
          deleted: true,
          original_user: submission.username,
          hours_since_submission: submission.hours_since_submission
        })
      ]
    );

    logger.security('Submission deleted', {
      submissionId,
      originalUserId: submission.user_id,
      originalUsername: submission.username,
      deletedBy: req.user?.username,
      deletedById: userId,
      isAdmin,
      hoursSinceSubmission: submission.hours_since_submission
    });

    const response: ApiResponse = {
      success: true,
      message: 'Submission deleted successfully'
    };

    res.json(response);
  });

  /**
   * Get submission statistics (admin only)
   */
  getSubmissionStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.dbService.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN submitted_at > datetime('now', '-24 hours') THEN 1 END) as last_24_hours,
        COUNT(CASE WHEN submitted_at > datetime('now', '-7 days') THEN 1 END) as last_7_days,
        COUNT(CASE WHEN submitted_at > datetime('now', '-30 days') THEN 1 END) as last_30_days,
        AVG(LENGTH(data)) as avg_data_size,
        MIN(submitted_at) as first_submission,
        MAX(submitted_at) as latest_submission
      FROM submissions
    `);

    const submissionsByUser = await this.dbService.query(`
      SELECT 
        u.username,
        COUNT(s.id) as submission_count,
        MAX(s.submitted_at) as last_submission,
        AVG(LENGTH(s.data)) as avg_size
      FROM users u
      LEFT JOIN submissions s ON u.id = s.user_id
      GROUP BY u.id, u.username
      HAVING submission_count > 0
      ORDER BY submission_count DESC
      LIMIT 10
    `);

    const submissionsByMonth = await this.dbService.query(`
      SELECT 
        strftime('%Y-%m', submitted_at) as month,
        COUNT(*) as count
      FROM submissions
      WHERE submitted_at > datetime('now', '-12 months')
      GROUP BY strftime('%Y-%m', submitted_at)
      ORDER BY month DESC
    `);

    logger.audit('Submission stats requested', req.user?.id);

    const response: ApiResponse = {
      success: true,
      data: {
        summary: stats[0] || {},
        topUsers: submissionsByUser,
        monthlyTrend: submissionsByMonth
      }
    };

    res.json(response);
  });

  /**
   * Export submissions as CSV (admin only)
   */
  exportSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND s.user_id = ?';
      params.push(userId);
    }

    if (dateFrom) {
      whereClause += ' AND s.submitted_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND s.submitted_at <= ?';
      params.push(dateTo);
    }

    const submissions = await this.dbService.query<any>(`
      SELECT 
        s.id,
        u.username,
        s.data,
        s.submitted_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.submitted_at DESC
    `, params);

    // Parse data and create CSV
    const csvRows = ['ID,Username,Patient Name,Incident Date,Chief Complaint,Submitted At'];

    for (const submission of submissions) {
      try {
        const data = JSON.parse(submission.data);
        const row = [
          submission.id,
          `"${submission.username}"`,
          `"${data.patientName || ''}"`,
          data.incidentDate || '',
          `"${(data.chiefComplaint || '').replace(/"/g, '""')}"`,
          submission.submitted_at
        ].join(',');
        csvRows.push(row);
      } catch (error) {
        logger.error('Failed to parse submission data for export', error, { 
          submissionId: submission.id 
        });
      }
    }

    const csv = csvRows.join('\n');

    logger.audit('Submissions exported', req.user?.id, {
      count: submissions.length,
      dateFilter: { dateFrom, dateTo },
      filterUserId: userId
    });

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=pcr-submissions-${new Date().toISOString().split('T')[0]}.csv`
    });

    res.send(csv);
  });

  /**
   * Get submission summary (quick stats for dashboard)
   */
  getSubmissionSummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.role === 'admin' ? null : req.user?.id!;

    let whereClause = '';
    const params: any[] = [];

    if (userId) {
      whereClause = 'WHERE user_id = ?';
      params.push(userId);
    }

    const summary = await this.dbService.queryOne<any>(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN submitted_at > datetime('now', '-24 hours') THEN 1 END) as today,
        COUNT(CASE WHEN submitted_at > datetime('now', '-7 days') THEN 1 END) as this_week,
        COUNT(CASE WHEN submitted_at > datetime('now', '-30 days') THEN 1 END) as this_month
      FROM submissions
      ${whereClause}
    `, params);

    const response: ApiResponse = {
      success: true,
      data: summary || { total: 0, today: 0, this_week: 0, this_month: 0 }
    };

    res.json(response);
  });
}