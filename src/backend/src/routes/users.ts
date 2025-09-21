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

// POST /api/users - Create new user (admin only)
router.post('/', authenticateToken, requireRole(['admin']), logActivity('create_user', 'user'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, firstName, lastName, role = 'user' } = req.body;

    // Validate required fields
    if (!username || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, first name, and last name are required'
      });
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any;
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin or user'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate user ID
    const userId = generateId();

    // Insert new user
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, username, username, passwordHash, firstName, lastName, role);

    // Get created user
    const newUser = db.prepare(`
      SELECT id, username, first_name, last_name, role, is_active, created_at
      FROM users WHERE id = ?
    `).get(userId) as any;

    const userData = {
      id: newUser.id,
      username: newUser.username,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: newUser.role,
      isActive: newUser.is_active,
      createdAt: newUser.created_at,
      lastLogin: null as string | null
    };

    res.status(201).json({
      success: true,
      data: userData,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/users - Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, active } = req.query;

    let query = 'SELECT id, username, first_name, last_name, role, is_active, created_at, last_login FROM users';
    const params: any[] = [];

    if (active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const users = db.prepare(query).all(...params) as any[];

    // Transform to match frontend expectations
    const transformedUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
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
      SELECT id, username, first_name, last_name, role, is_active, created_at, last_login
      FROM users WHERE id = ?
    `).get(id) as any;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = {
      id: user.id,
      username: user.username,
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
    const { firstName, lastName, role, isActive } = req.body;

    // Users can only update their own profile unless they're admin
    if (req.user!.role !== 'admin' && req.user!.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as any;

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
      SELECT id, username, first_name, last_name, role, is_active, created_at, updated_at, last_login
      FROM users WHERE id = ?
    `).get(id) as any;

    const userData = {
      id: updatedUser.id,
      username: updatedUser.username,
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

// DELETE /api/users/:id - Delete user (admin only; cannot delete admins or yourself)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  logActivity('delete_user', 'user'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // You can't delete yourself
      if (req.user!.id === id) {
        return res.status(400).json({ success: false, message: "You can't delete your own account." });
      }

      // Fetch target
      const target = db
        .prepare('SELECT id, username, role FROM users WHERE id = ?')
        .get(id) as any;

      if (!target) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Do not allow deleting admins (or at least the last admin)
      if (String(target.role).toLowerCase() === 'admin') {
        // If you want to allow deleting admins except the last one, use this block:
        const adminCount = db
          .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")
          .get() as any;
        const totalAdmins = adminCount.c as number;

        if (totalAdmins <= 1) {
          return res.status(400).json({ success: false, message: 'Cannot delete the last admin user.' });
        }

        // If you want to strictly forbid deleting any admin at all, use:
        // return res.status(400).json({ success: false, message: 'Cannot delete an admin user.' });
      }

      // Attempt hard delete
      try {
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (result.changes === 0) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }
      } catch (err: any) {
        // Foreign key constraint? e.g., user referenced elsewhere (PCRs, etc.)
        const msg = String(err?.message || '');
        if (msg.includes('FOREIGN KEY')) {
          return res.status(409).json({
            success: false,
            message:
              'Cannot delete this user because there are related records. Remove or reassign related records and try again.',
          });
        }
        throw err;
      }

      return res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);


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
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(id) as any;

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