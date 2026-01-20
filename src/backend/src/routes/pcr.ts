import { Router, Response } from 'express';
import db from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../middleware/logger';
import { cleanupService } from '../services/cleanup';

const router = Router();

// Generate simple ID
function generateId(): string {
  return 'pcr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// GET /api/pcr/:id - Get specific PCR report (must be before GET / to avoid route conflicts)
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // First fetch the report without filtering by created_by
    const report = db.prepare(`
      SELECT * FROM pcr_reports
      WHERE id = ?
    `).get(id) as any;

    if (!report) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
    }

    const isOwner = report.created_by === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // Allow: admin can view any report, owners can view their own
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Parse form_data JSON
    const reportData = {
      ...report,
      form_data: JSON.parse(report.form_data)
    };

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Get PCR report error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/pcr - Get all PCR reports for current user (admins see all)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const isAdmin = req.user!.role === 'admin';

    let query = `
      SELECT
        id,
        status,
        created_at,
        updated_at,
        created_by,
        NULLIF(TRIM(json_extract(form_data, '$.reportNumber')), '') AS report_number
      FROM pcr_reports
      `;
    const params: any[] = [];

    // Admins see all reports, regular users see only their own
    if (!isAdmin) {
      query += ' WHERE created_by = ?';
      params.push(req.user!.id);
    }

    if (status) {
      query += isAdmin ? ' WHERE status = ?' : ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const reports = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Get PCR reports error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/pcr - Create new PCR report
router.post('/', authenticateToken, logActivity('create_pcr', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { form_data, status = 'draft' } = req.body;

    if (!form_data) {
      return res.status(400).json({ success: false, message: 'Form data required' });
    }

    const reportId = generateId();

    db.prepare(`
      INSERT INTO pcr_reports (id, form_data, status, created_by)
      VALUES (?, ?, ?, ?)
    `).run(reportId, JSON.stringify(form_data), status, req.user!.id);

    const newReport = db.prepare('SELECT * FROM pcr_reports WHERE id = ?').get(reportId) as any;

    res.status(201).json({
      success: true,
      data: {
        ...newReport,
        form_data: JSON.parse(newReport.form_data)
      }
    });

  } catch (error) {
    console.error('Create PCR report error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/pcr/:id - Update PCR report
router.put('/:id', authenticateToken, logActivity('update_pcr', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { form_data, status } = req.body;

    // Fetch report without filtering by created_by
    const existingReport = db.prepare(`
      SELECT id, status, created_by FROM pcr_reports
      WHERE id = ?
    `).get(id) as any;

    if (!existingReport) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
    }

    const isOwner = existingReport.created_by === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // Allow: admin OR owner can update
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Regular users can only edit drafts (submitted reports locked for non-admins)
    if (!isAdmin && existingReport.status === 'submitted') {
      return res.status(403).json({ success: false, message: 'Submitted reports cannot be edited' });
    }

    // Update report
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (form_data) {
      updateFields.push('form_data = ?');
      updateValues.push(JSON.stringify(form_data));
    }

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    db.prepare(`
      UPDATE pcr_reports
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateValues);

    // Get updated report
    const updatedReport = db.prepare('SELECT * FROM pcr_reports WHERE id = ?').get(id) as any;

    res.json({
      success: true,
      data: {
        ...updatedReport,
        form_data: JSON.parse(updatedReport.form_data)
      }
    });

  } catch (error) {
    console.error('Update PCR report error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/pcr/:id - Delete PCR report (drafts and submissions)
router.delete('/:id', authenticateToken, logActivity('delete_pcr', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Load report (don't filter by created_by here so admins can act too)
    const report = db.prepare(`
      SELECT id, status, created_by
      FROM pcr_reports
      WHERE id = ?
    `).get(id) as any;

    if (!report) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
    }

    const isOwner = report.created_by === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // Allow: owner or admin
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // If there are child rows, delete them first or ensure FK ON DELETE CASCADE
    db.prepare('DELETE FROM pcr_reports WHERE id = ?').run(id);

    return res.json({ success: true, message: 'PCR report deleted' });
  } catch (error) {
    console.error('Delete PCR report error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/submissions - Submit PCR (for compatibility with frontend)
router.post('/submit', authenticateToken, logActivity('submit_pcr', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const formData = req.body.data;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'Form data required' });
    }

    const reportId = generateId();

    // Create as submitted report
    db.prepare(`
      INSERT INTO pcr_reports (id, form_data, status, created_by)
      VALUES (?, ?, ?, ?)
    `).run(reportId, JSON.stringify(formData), 'submitted', req.user!.id);

    res.status(201).json({
      success: true,
      data: {
        id: reportId,
        message: 'PCR submitted successfully'
      }
    });

  } catch (error) {
    console.error('Submit PCR error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin endpoints for cleanup management
// GET /api/pcr/cleanup/preview - Preview what will be cleaned up
router.get('/cleanup/preview', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const preview = cleanupService.getCleanupPreview();

    res.json({
      success: true,
      data: {
        reportsToDelete: preview.pcrCount,
        oldestReportDate: preview.oldestPCRDate,
        logsToDelete: preview.logsCount,
        oldestLogDate: preview.oldestLogDate,
        pcrRetentionPeriod: '72 hours',
        logRetentionPeriod: '7 days'
      }
    });

  } catch (error) {
    console.error('Get cleanup preview error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/pcr/cleanup/run - Manually trigger cleanup
router.post('/cleanup/run', authenticateToken, logActivity('manual_cleanup', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const result = cleanupService.manualCleanup();

    res.json({
      success: true,
      data: {
        deletedPCRCount: result.deletedPCRCount,
        deletedLogsCount: result.deletedLogsCount,
        message: `Successfully deleted ${result.deletedPCRCount} PCR report(s) older than 72 hours and ${result.deletedLogsCount} log(s) older than 7 days`
      }
    });

  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;