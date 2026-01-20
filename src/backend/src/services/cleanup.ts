import db from '../database'

export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null

  // ✅ Retention rules (easy to change later)
  private readonly PCR_RETENTION_HOURS = 72
  private readonly LOG_RETENTION_DAYS = 7

  start(): void {
    console.log('📅 Starting cleanup service...')

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
      console.log('📅 Cleanup service stopped')
    }
  }

  private runCleanup(): void {
    try {
      console.log('🧹 Running cleanup...')

      // =========================
      // 1) Delete PCR reports (submitted + draft) older than 72 hours
      // =========================
      const deletePCRQuery = `
        DELETE FROM pcr_reports
        WHERE status IN ('submitted', 'draft')
        AND datetime(created_at) < datetime('now', ?)
      `

      const pcrRetention = `-${this.PCR_RETENTION_HOURS} hours`
      const pcrResult = db.prepare(deletePCRQuery).run(pcrRetention)

      if (pcrResult.changes > 0) {
        console.log(`🗑️ Deleted ${pcrResult.changes} PCR report(s) older than ${this.PCR_RETENTION_HOURS} hours`)
        this.logCleanupActivity('cleanup_pcr_reports', pcrResult.changes, {
          reason: `${this.PCR_RETENTION_HOURS}_hour_retention`,
          statuses: ['draft', 'submitted'],
        })
      } else {
        console.log('✅ No PCR reports to clean up')
      }

      // =========================
      // 2) Delete activity logs older than 7 days
      // =========================
      const deleteLogsQuery = `
        DELETE FROM activity_logs
        WHERE datetime(created_at) < datetime('now', ?)
      `

      const logRetention = `-${this.LOG_RETENTION_DAYS} days`
      const logsResult = db.prepare(deleteLogsQuery).run(logRetention)

      if (logsResult.changes > 0) {
        console.log(`🗑️ Deleted ${logsResult.changes} activity log(s) older than ${this.LOG_RETENTION_DAYS} days`)

        // Optional: You can log this too, BUT logging would create a new log row.
        // So usually you either:
        // - don't log it, OR
        // - log it somewhere else (console only).
      } else {
        console.log('✅ No activity logs to clean up')
      }

    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

  private logCleanupActivity(action: string, deletedCount: number, detailsObj: any): void {
    try {
      const logId =
        'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)

      db.prepare(`
        INSERT INTO activity_logs (id, user_id, action, resource_type, details, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        logId,
        'system',
        action,
        'cleanup',
        JSON.stringify({ deletedCount, ...detailsObj })
      )
    } catch (error) {
      console.error('Failed to log cleanup activity:', error)
    }
  }

  // Manual cleanup method for testing/admin use
  manualCleanup(): { deletedPCRCount: number; deletedLogsCount: number } {
    try {
      console.log('🧹 Running manual cleanup...')

      const pcrRetention = `-${this.PCR_RETENTION_HOURS} hours`
      const logsRetention = `-${this.LOG_RETENTION_DAYS} days`

      const deletePCRQuery = `
        DELETE FROM pcr_reports
        WHERE status IN ('submitted', 'draft')
        AND datetime(created_at) < datetime('now', ?)
      `
      const pcrResult = db.prepare(deletePCRQuery).run(pcrRetention)

      const deleteLogsQuery = `
        DELETE FROM activity_logs
        WHERE datetime(created_at) < datetime('now', ?)
      `
      const logsResult = db.prepare(deleteLogsQuery).run(logsRetention)

      if (pcrResult.changes > 0) {
        this.logCleanupActivity('cleanup_pcr_reports', pcrResult.changes, {
          reason: `${this.PCR_RETENTION_HOURS}_hour_retention`,
          statuses: ['draft', 'submitted'],
          manual: true,
        })
      }

      console.log(`🗑️ Manual cleanup: PCR deleted=${pcrResult.changes}, logs deleted=${logsResult.changes}`)

      return {
        deletedPCRCount: pcrResult.changes,
        deletedLogsCount: logsResult.changes,
      }
    } catch (error) {
      console.error('❌ Error during manual cleanup:', error)
      throw error
    }
  }

  // Preview method (for UI preview)
  getCleanupPreview(): {
    pcrCount: number
    logsCount: number
    oldestPCRDate: string | null
    oldestLogDate: string | null
  } {
    try {
      const pcrRetention = `-${this.PCR_RETENTION_HOURS} hours`
      const logsRetention = `-${this.LOG_RETENTION_DAYS} days`

      const pcrPreviewQuery = `
        SELECT COUNT(*) as count, MIN(created_at) as oldestDate
        FROM pcr_reports
        WHERE status IN ('submitted', 'draft')
        AND datetime(created_at) < datetime('now', ?)
      `
      const pcrPreview = db.prepare(pcrPreviewQuery).get(pcrRetention) as {
        count: number
        oldestDate: string | null
      }

      const logPreviewQuery = `
        SELECT COUNT(*) as count, MIN(created_at) as oldestDate
        FROM activity_logs
        WHERE datetime(created_at) < datetime('now', ?)
      `
      const logPreview = db.prepare(logPreviewQuery).get(logsRetention) as {
        count: number
        oldestDate: string | null
      }

      return {
        pcrCount: pcrPreview.count,
        logsCount: logPreview.count,
        oldestPCRDate: pcrPreview.oldestDate,
        oldestLogDate: logPreview.oldestDate,
      }
    } catch (error) {
      console.error('❌ Error getting cleanup preview:', error)
      throw error
    }
  }
}

export const cleanupService = new CleanupService()