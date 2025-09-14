import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../database';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { logActivity } from '../middleware/logger';

const router = Router();

// Generate simple ID
function generateId(): string {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// GET /api/users - Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, active } = req.query;

    let query = 'SELECT id, username, email, first_name, last_name, role, is_active, created_at, last_login FROM users';
    const params: any[] = [];

    if (active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const users = db.prepare(query).all(...params);

    // Transform to match frontend expectations
    const transformedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }));

    res.json({
      success: true,
      data: transformedUsers
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user!.role !== 'admin' && req.user!.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = db.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, created_at, last_login
      FROM users WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, logActivity('update_user', 'user'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive } = req.body;

    // Users can only update their own profile unless they're admin
    if (req.user!.role !== 'admin' && req.user!.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (firstName) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }

    if (lastName) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }

    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    // Only admin can update role and active status
    if (req.user!.role === 'admin') {
      if (role) {
        updateFields.push('role = ?');
        updateValues.push(role);
      }

      if (isActive !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(isActive ? 1 : 0);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    // Update user
    db.prepare(`
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateValues);

    // Get updated user
    const updatedUser = db.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at, last_login
      FROM users WHERE id = ?
    `).get(id);

    const userData = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      role: updatedUser.role,
      isActive: updatedUser.is_active,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      lastLogin: updatedUser.last_login
    };

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/users/:id/change-password - Change user password
router.post('/:id/change-password', authenticateToken, logActivity('change_password', 'user'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Users can only change their own password unless they're admin
    if (req.user!.role !== 'admin' && req.user!.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password required' });
    }

    // Get user
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If not admin, verify current password
    if (req.user!.role !== 'admin') {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password required' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Invalid current password' });
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, id);

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;