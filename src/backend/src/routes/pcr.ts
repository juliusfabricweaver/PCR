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

// GET /api/pcr - Get all PCR reports for current user
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT id, status, created_at, updated_at FROM pcr_reports WHERE created_by = ?';
    const params: any[] = [req.user!.id];

    if (status) {
      query += ' AND status = ?';
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

// GET /api/pcr/:id - Get specific PCR report
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const report = db.prepare(`
      SELECT * FROM pcr_reports
      WHERE id = ? AND created_by = ?
    `).get(id, req.user!.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
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

    const newReport = db.prepare('SELECT * FROM pcr_reports WHERE id = ?').get(reportId);

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

    // Check if report exists and belongs to user
    const existingReport = db.prepare(`
      SELECT id FROM pcr_reports
      WHERE id = ? AND created_by = ?
    `).get(id, req.user!.id);

    if (!existingReport) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
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
    const updatedReport = db.prepare('SELECT * FROM pcr_reports WHERE id = ?').get(id);

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

// DELETE /api/pcr/:id - Delete PCR report (only drafts)
router.delete('/:id', authenticateToken, logActivity('delete_pcr', 'pcr_report'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if report exists, belongs to user, and is a draft
    const existingReport = db.prepare(`
      SELECT id, status FROM pcr_reports
      WHERE id = ? AND created_by = ?
    `).get(id, req.user!.id);

    if (!existingReport) {
      return res.status(404).json({ success: false, message: 'PCR report not found' });
    }

    if (existingReport.status !== 'draft') {
      return res.status(403).json({ success: false, message: 'Only draft reports can be deleted' });
    }

    // Delete report
    db.prepare('DELETE FROM pcr_reports WHERE id = ?').run(id);

    res.json({ success: true, message: 'PCR report deleted' });

  } catch (error) {
    console.error('Delete PCR report error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
        reportsToDelete: preview.count,
        oldestReportDate: preview.oldestDate,
        retentionPeriod: '24 hours'
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
        deletedCount: result.deletedCount,
        message: `Successfully deleted ${result.deletedCount} PCR report(s) older than 24 hours`
      }
    });

  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;