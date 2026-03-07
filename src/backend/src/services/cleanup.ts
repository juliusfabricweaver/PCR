import db from '../database'

export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null

  // Retention periods
  private readonly PCR_RETENTION_YEARS = 1
  private readonly LOG_RETENTION_DAYS = 120 // ~4 months

  start(): void {
    console.log('📅 Starting cleanup service...')

    // Run cleanup immediately
    this.runCleanup()

    // Run every hour
    this.cleanupInterval = setInterval(() => {
      this.runCleanup()
    }, 60 * 60 * 1000)
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

      const pcrResult = this.cleanupPCRReports()
      const logsResult = this.cleanupActivityLogs()

      if (pcrResult.changes > 0 || logsResult.changes > 0) {
        console.log(`🗑️ Deleted ${pcrResult.changes} PCR report(s) older than ${this.PCR_RETENTION_YEARS} year`)
        console.log(`🗑️ Deleted ${logsResult.changes} activity log(s) older than ${this.LOG_RETENTION_DAYS} days`)

        this.logCleanupActivity(pcrResult.changes, logsResult.changes)
      } else {
        console.log('✅ No records to clean up')
      }

    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

  private cleanupPCRReports(): { changes: number } {
    const deleteQuery = `
      DELETE FROM pcr_reports
      WHERE status IN ('submitted','draft','approved')
      AND datetime(created_at) < datetime('now', '-${this.PCR_RETENTION_YEARS} year')
    `
    return db.prepare(deleteQuery).run()
  }

  private cleanupActivityLogs(): { changes: number } {
    const deleteQuery = `
      DELETE FROM activity_logs
      WHERE datetime(created_at) < datetime('now', '-${this.LOG_RETENTION_DAYS} days')
    `
    return db.prepare(deleteQuery).run()
  }

  private logCleanupActivity(deletedPCRCount: number, deletedLogsCount: number): void {
    try {
      const logId = 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)

      db.prepare(`
        INSERT INTO activity_logs (id, user_id, action, resource_type, details, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        logId,
        'system',
        'cleanup_pcr_reports',
        'pcr_report',
        JSON.stringify({
          deletedPCRCount,
          deletedLogsCount,
          pcrRetention: `${this.PCR_RETENTION_YEARS}_year_retention`,
          logRetention: `${this.LOG_RETENTION_DAYS}_day_retention`
        })
      )
    } catch (error) {
      console.error('Failed to log cleanup activity:', error)
    }
  }

  manualCleanup(): { deletedPCRCount: number; deletedLogsCount: number } {
    try {
      console.log('🧹 Running manual cleanup...')

      const pcrDeleteQuery = `
        DELETE FROM pcr_reports
        WHERE status IN ('submitted','approved')
        AND datetime(created_at) < datetime('now', '-${this.PCR_RETENTION_YEARS} year')
      `
      const pcrResult = db.prepare(pcrDeleteQuery).run()

      const logsDeleteQuery = `
        DELETE FROM activity_logs
        WHERE datetime(created_at) < datetime('now', '-${this.LOG_RETENTION_DAYS} days')
      `
      const logsResult = db.prepare(logsDeleteQuery).run()

      if (pcrResult.changes > 0 || logsResult.changes > 0) {
        console.log(`🗑️ Manually deleted ${pcrResult.changes} PCR report(s) older than ${this.PCR_RETENTION_YEARS} year`)
        console.log(`🗑️ Manually deleted ${logsResult.changes} activity log(s) older than ${this.LOG_RETENTION_DAYS} days`)
        this.logCleanupActivity(pcrResult.changes, logsResult.changes)
      }

      return {
        deletedPCRCount: pcrResult.changes,
        deletedLogsCount: logsResult.changes
      }

    } catch (error) {
      console.error('❌ Error during manual cleanup:', error)
      throw error
    }
  }

  getCleanupPreview(): {
    pcrCount: number
    oldestPCRDate: string | null
    logsCount: number
    oldestLogDate: string | null
  } {
    try {
      const pcrQuery = `
        SELECT COUNT(*) as count, MIN(created_at) as oldestDate
        FROM pcr_reports
        WHERE status IN ('submitted','approved')
        AND datetime(created_at) < datetime('now', '-${this.PCR_RETENTION_YEARS} year')
      `
      const pcrResult = db.prepare(pcrQuery).get() as { count: number; oldestDate: string | null }

      const logsQuery = `
        SELECT COUNT(*) as count, MIN(created_at) as oldestDate
        FROM activity_logs
        WHERE datetime(created_at) < datetime('now', '-${this.LOG_RETENTION_DAYS} days')
      `
      const logsResult = db.prepare(logsQuery).get() as { count: number; oldestDate: string | null }

      return {
        pcrCount: pcrResult.count,
        oldestPCRDate: pcrResult.oldestDate,
        logsCount: logsResult.count,
        oldestLogDate: logsResult.oldestDate
      }

    } catch (error) {
      console.error('❌ Error getting cleanup preview:', error)
      throw error
    }
  }
}

export const cleanupService = new CleanupService()