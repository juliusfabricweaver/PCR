/**
 * Draft management controller for auto-saved PCR forms
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { EncryptionService } from '../services/encryption.service';
import { logger } from '../services/logger';
import { 
  NotFoundError,
  ValidationError,
  AuthorizationError,
  EncryptionError,
  DraftExpiredError 
} from '../utils/errors';
import { Draft, DraftData, ApiResponse, PaginatedResponse } from '../types';
import { asyncHandler } from '../middleware/error.middleware';

export class DraftController {
  constructor(
    private dbService: DatabaseService,
    private encryptionService: EncryptionService
  ) {}

  /**
   * Save or update a draft
   */
  saveDraft = asyncHandler(async (req: Request, res: Response) => {
    const { data } = req.body;
    const userId = req.user?.id!;
    const draftId = req.params.id ? parseInt(req.params.id) : null;

    if (!data || typeof data !== 'object') {
      throw new ValidationError('Draft data is required and must be an object');
    }

    // Set expiration time (24 hours from now by default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      // Encrypt the draft data
      const encryptedData = await this.encryptionService.encryptDraftData(data);

      let result;
      let isUpdate = false;

      if (draftId) {
        // Update existing draft
        const existingDraft = await this.dbService.findOne<Draft>('drafts', {
          where: { id: draftId, user_id: userId }
        });

        if (!existingDraft) {
          throw new NotFoundError('Draft', draftId);
        }

        // Check if draft has expired
        if (new Date(existingDraft.expires_at) < new Date()) {
          throw new DraftExpiredError(draftId);
        }

        result = await this.dbService.run(`
          UPDATE drafts 
          SET data_encrypted = ?, iv = ?, salt = ?, auth_tag = ?, expires_at = ?
          WHERE id = ? AND user_id = ?
        `, [
          encryptedData.data_encrypted,
          encryptedData.iv,
          encryptedData.salt,
          encryptedData.auth_tag,
          expiresAt.toISOString(),
          draftId,
          userId
        ]);

        isUpdate = true;
        result.lastID = draftId;
      } else {
        // Create new draft
        result = await this.dbService.run(`
          INSERT INTO drafts (user_id, data_encrypted, iv, salt, auth_tag, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `, [
          userId,
          encryptedData.data_encrypted,
          encryptedData.iv,
          encryptedData.salt,
          encryptedData.auth_tag,
          expiresAt.toISOString()
        ]);
      }

      // Log the action
      await this.dbService.run(
        'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
        [
          userId,
          'draft_saved',
          JSON.stringify({
            draft_id: result.lastID,
            is_update: isUpdate,
            data_size: JSON.stringify(data).length,
            expires_at: expiresAt.toISOString()
          })
        ]
      );

      logger.info(`Draft ${isUpdate ? 'updated' : 'saved'}`, {
        userId,
        draftId: result.lastID,
        dataSize: JSON.stringify(data).length,
        expiresAt: expiresAt.toISOString()
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: result.lastID,
          userId,
          expiresAt: expiresAt.toISOString(),
          isUpdate
        },
        message: `Draft ${isUpdate ? 'updated' : 'saved'} successfully`
      };

      res.json(response);

    } catch (error) {
      if (error instanceof Error && error.message.includes('encrypt')) {
        throw new EncryptionError('Failed to encrypt draft data', 'encrypt');
      }
      throw error;
    }
  });

  /**
   * Get a specific draft by ID
   */
  getDraft = asyncHandler(async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);
    const userId = req.user?.id!;

    if (!draftId) {
      throw new ValidationError('Invalid draft ID');
    }

    const draft = await this.dbService.queryOne<any>(`
      SELECT id, user_id, data_encrypted, iv, salt, auth_tag, created_at, expires_at
      FROM drafts 
      WHERE id = ? AND user_id = ?
    `, [draftId, userId]);

    if (!draft) {
      throw new NotFoundError('Draft', draftId);
    }

    // Check if draft has expired
    if (new Date(draft.expires_at) < new Date()) {
      // Clean up expired draft
      await this.dbService.run('DELETE FROM drafts WHERE id = ?', [draftId]);
      throw new DraftExpiredError(draftId);
    }

    try {
      // Decrypt the draft data
      const decryptedData = await this.encryptionService.decryptDraftData({
        data_encrypted: draft.data_encrypted,
        iv: draft.iv,
        salt: draft.salt,
        auth_tag: draft.auth_tag
      });

      // Log the action
      await this.dbService.run(
        'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
        [
          userId,
          'draft_loaded',
          JSON.stringify({
            draft_id: draftId,
            expires_at: draft.expires_at
          })
        ]
      );

      logger.debug('Draft loaded', {
        userId,
        draftId,
        expiresAt: draft.expires_at
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: draft.id,
          userId: draft.user_id,
          data: decryptedData,
          createdAt: draft.created_at,
          expiresAt: draft.expires_at
        }
      };

      res.json(response);

    } catch (error) {
      if (error instanceof Error && error.message.includes('decrypt')) {
        logger.error('Failed to decrypt draft', error, { userId, draftId });
        throw new EncryptionError('Failed to decrypt draft data', 'decrypt');
      }
      throw error;
    }
  });

  /**
   * Get all drafts for the current user
   */
  getUserDrafts = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    // Only get non-expired drafts
    const drafts = await this.dbService.query<any>(`
      SELECT id, created_at, expires_at
      FROM drafts 
      WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM drafts 
      WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP
    `, [userId]);

    logger.debug('User drafts requested', {
      userId,
      count: drafts.length,
      page,
      limit
    });

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: drafts,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Delete a draft
   */
  deleteDraft = asyncHandler(async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);
    const userId = req.user?.id!;

    if (!draftId) {
      throw new ValidationError('Invalid draft ID');
    }

    // Check if draft exists and belongs to user
    const draft = await this.dbService.findOne<Draft>('drafts', {
      where: { id: draftId, user_id: userId }
    });

    if (!draft) {
      throw new NotFoundError('Draft', draftId);
    }

    // Delete the draft
    const result = await this.dbService.run('DELETE FROM drafts WHERE id = ?', [draftId]);

    if (result.changes === 0) {
      throw new NotFoundError('Draft', draftId);
    }

    // Log the action
    await this.dbService.run(
      'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
      [
        userId,
        'form_cleared',
        JSON.stringify({
          draft_id: draftId,
          deleted: true
        })
      ]
    );

    logger.info('Draft deleted', {
      userId,
      draftId
    });

    const response: ApiResponse = {
      success: true,
      message: 'Draft deleted successfully'
    };

    res.json(response);
  });

  /**
   * Get all drafts (admin only)
   */
  getAllDrafts = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE d.expires_at > CURRENT_TIMESTAMP';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND d.user_id = ?';
      params.push(userId);
    }

    params.push(limit, offset);

    const drafts = await this.dbService.query<any>(`
      SELECT 
        d.id,
        d.user_id,
        u.username,
        d.created_at,
        d.expires_at,
        LENGTH(d.data_encrypted) as encrypted_size
      FROM drafts d
      JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `, params);

    const countParams = userId ? [userId] : [];
    const totalCount = await this.dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM drafts d
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `, countParams);

    logger.audit('All drafts requested', req.user?.id, {
      filterUserId: userId,
      page,
      limit,
      totalCount: totalCount?.count || 0
    });

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        items: drafts,
        total: totalCount?.count || 0,
        page,
        pages: Math.ceil((totalCount?.count || 0) / limit),
        limit
      }
    };

    res.json(response);
  });

  /**
   * Clean up expired drafts (admin only)
   */
  cleanupExpiredDrafts = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dbService.run(
      'DELETE FROM drafts WHERE expires_at < CURRENT_TIMESTAMP'
    );

    logger.audit('Expired drafts cleanup', req.user?.id, {
      deletedCount: result.changes
    });

    const response: ApiResponse = {
      success: true,
      data: {
        deletedCount: result.changes
      },
      message: `Cleaned up ${result.changes} expired draft(s)`
    };

    res.json(response);
  });

  /**
   * Get draft statistics (admin only)
   */
  getDraftStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.dbService.query(`
      SELECT 
        COUNT(*) as total_drafts,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_drafts,
        COUNT(CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 1 END) as expired_drafts,
        COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as recent_drafts,
        AVG(LENGTH(data_encrypted)) as avg_size,
        MIN(created_at) as oldest_draft,
        MAX(created_at) as newest_draft
      FROM drafts
    `);

    const userStats = await this.dbService.query(`
      SELECT 
        u.username,
        COUNT(d.id) as draft_count,
        MAX(d.created_at) as last_draft
      FROM users u
      LEFT JOIN drafts d ON u.id = d.user_id AND d.expires_at > CURRENT_TIMESTAMP
      GROUP BY u.id, u.username
      HAVING draft_count > 0
      ORDER BY draft_count DESC
      LIMIT 10
    `);

    logger.audit('Draft stats requested', req.user?.id);

    const response: ApiResponse = {
      success: true,
      data: {
        summary: stats[0] || {},
        topUsers: userStats
      }
    };

    res.json(response);
  });

  /**
   * Force delete a draft (admin only)
   */
  forceDeleteDraft = asyncHandler(async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);

    if (!draftId) {
      throw new ValidationError('Invalid draft ID');
    }

    // Get draft info before deletion
    const draft = await this.dbService.queryOne<any>(`
      SELECT d.*, u.username 
      FROM drafts d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [draftId]);

    if (!draft) {
      throw new NotFoundError('Draft', draftId);
    }

    // Delete the draft
    const result = await this.dbService.run('DELETE FROM drafts WHERE id = ?', [draftId]);

    if (result.changes === 0) {
      throw new NotFoundError('Draft', draftId);
    }

    logger.security('Draft force deleted by admin', {
      draftId,
      draftUserId: draft.user_id,
      draftUsername: draft.username,
      deletedBy: req.user?.username,
      deletedById: req.user?.id
    });

    const response: ApiResponse = {
      success: true,
      message: `Draft ${draftId} (belonging to ${draft.username}) has been deleted`
    };

    res.json(response);
  });
}