import db from '../database'
import { logActivity } from '../middleware/logger'

export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null

  start(): void {
    console.log('📅 Starting PCR cleanup service...')

    // Run cleanup immediately on start
    this.runCleanup()

    // Schedule cleanup to run every hour
    this.cleanupInterval = setInterval(() => {
      this.runCleanup()
    }, 60 * 60 * 1000) // 1 hour
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      console.log('📅 PCR cleanup service stopped')
    }
  }

  private runCleanup(): void {
    try {
      console.log('🧹 Running PCR reports cleanup...')

      // Delete submitted PCR reports older than 24 hours
      const deleteQuery = `
        DELETE FROM pcr_reports
        WHERE status IN ('submitted','draft')
        AND datetime(created_at) < datetime('now', '-24 hours')
      `

      const result = db.prepare(deleteQuery).run()

      if (result.changes > 0) {
        console.log(`🗑️  Deleted ${result.changes} PCR report(s) older than 24 hours`)

        // Log the cleanup activity
        this.logCleanupActivity(result.changes)
      } else {
        console.log('✅ No PCR reports to clean up')
      }

    } catch (error) {
      console.error('❌ Error during PCR cleanup:', error)
    }
  }

  private logCleanupActivity(deletedCount: number): void {
    try {
      // Create a system activity log entry
      const logId = 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)

      db.prepare(`
        INSERT INTO activity_logs (id, user_id, action, resource_type, details, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        logId,
        'system', // Use 'system' as user_id for automated tasks
        'cleanup_pcr_reports',
        'pcr_report',
        JSON.stringify({ deletedCount, reason: '24_hour_retention' })
      )
    } catch (error) {
      console.error('Failed to log cleanup activity:', error)
    }
  }

  // Manual cleanup method for testing or admin use
  manualCleanup(): { deletedCount: number } {
    try {
      console.log('🧹 Running manual PCR reports cleanup...')

      const deleteQuery = `
        DELETE FROM pcr_reports
        WHERE status = 'submitted'
        AND datetime(created_at) < datetime('now', '-24 hours')
      `

      const result = db.prepare(deleteQuery).run()

      if (result.changes > 0) {
        console.log(`🗑️  Manually deleted ${result.changes} PCR report(s) older than 24 hours`)
        this.logCleanupActivity(result.changes)
      }

      return { deletedCount: result.changes }

    } catch (error) {
      console.error('❌ Error during manual PCR cleanup:', error)
      throw error
    }
  }

  // Get count of reports that would be deleted (for preview)
  getCleanupPreview(): { count: number, oldestDate: string | null } {
    try {
      const countQuery = `
        SELECT COUNT(*) as count, MIN(created_at) as oldestDate
        FROM pcr_reports
        WHERE status = 'submitted'
        AND datetime(created_at) < datetime('now', '-24 hours')
      `

      const result = db.prepare(countQuery).get() as { count: number, oldestDate: string | null }
      return result

    } catch (error) {
      console.error('❌ Error getting cleanup preview:', error)
      throw error
    }
  }
}

// Export singleton instance
export const cleanupService = new CleanupService()