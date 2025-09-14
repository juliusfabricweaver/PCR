import { Router } from 'express'
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth'
import db from '../database'
import { ActivityLog, PaginatedResponse, PaginationParams } from '../../../shared/types'

const router = Router()

router.get('/', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc',
      action,
      user_id,
      dateFrom,
      dateTo
    } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    let whereConditions = []
    let queryParams = []

    if (action) {
      whereConditions.push('al.action = ?')
      queryParams.push(action)
    }

    if (user_id) {
      whereConditions.push('al.user_id = ?')
      queryParams.push(user_id)
    }

    if (dateFrom) {
      whereConditions.push('al.created_at >= ?')
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereConditions.push('al.created_at <= ?')
      queryParams.push(dateTo)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const validSortColumns = ['created_at', 'action', 'username']
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at'
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `

    const countResult = db.prepare(countQuery).get(...queryParams) as { total: number }
    const totalCount = countResult.total

    // Get paginated logs with user information
    const logsQuery = `
      SELECT
        al.id,
        al.user_id,
        u.username,
        u.first_name,
        u.last_name,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `

    queryParams.push(limitNum, offset)
    const logs = db.prepare(logsQuery).all(...queryParams) as ActivityLog[]

    const response: PaginatedResponse<ActivityLog> = {
      items: logs,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum)
    }

    res.json(response)
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    res.status(500).json({ error: 'Failed to fetch activity logs' })
  }
})

// Get activity log statistics
router.get('/stats', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query

    let whereConditions = []
    let queryParams = []

    if (dateFrom) {
      whereConditions.push('created_at >= ?')
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereConditions.push('created_at <= ?')
      queryParams.push(dateTo)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get action counts
    const actionStatsQuery = `
      SELECT action, COUNT(*) as count
      FROM activity_logs
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
    `

    const actionStats = db.prepare(actionStatsQuery).all(...queryParams)

    // Get user activity counts
    const userStatsQuery = `
      SELECT
        al.user_id,
        u.username,
        u.first_name,
        u.last_name,
        COUNT(*) as activity_count
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY al.user_id, u.username, u.first_name, u.last_name
      ORDER BY activity_count DESC
      LIMIT 10
    `

    const userStats = db.prepare(userStatsQuery).all(...queryParams)

    // Get recent activity summary
    const recentActivityQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM activity_logs
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `

    const recentActivity = db.prepare(recentActivityQuery).all(...queryParams)

    res.json({
      actionStats,
      userStats,
      recentActivity
    })
  } catch (error) {
    console.error('Error fetching activity log stats:', error)
    res.status(500).json({ error: 'Failed to fetch activity log statistics' })
  }
})

export default router