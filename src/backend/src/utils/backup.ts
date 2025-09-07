/**
 * Database backup and restore utilities
 */

import { DatabaseService } from '../database/database.service';
import { logger } from '../services/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export interface BackupOptions {
  includeData: boolean;
  compress: boolean;
  destination: string;
  encryptionPassword?: string;
}

export interface RestoreOptions {
  source: string;
  encryptionPassword?: string;
  overwrite: boolean;
}

export interface BackupInfo {
  filename: string;
  createdAt: Date;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  tables: string[];
}

export class BackupService {
  constructor(private dbService: DatabaseService) {}

  /**
   * Create a database backup
   */
  async createBackup(options: BackupOptions): Promise<BackupInfo> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `pcr-backup-${timestamp}`;
      const extension = options.compress ? '.sql.gz' : '.sql';
      const filename = `${baseFilename}${extension}`;
      const backupPath = path.join(options.destination, filename);

      // Ensure destination directory exists
      await fs.mkdir(options.destination, { recursive: true });

      logger.info('Starting database backup', {
        destination: backupPath,
        includeData: options.includeData,
        compress: options.compress
      });

      // Get all tables
      const tables = await this.getTables();
      
      // Generate SQL dump
      const sqlDump = await this.generateSQLDump(tables, options.includeData);

      // Write backup file
      if (options.compress) {
        await this.writeCompressedBackup(sqlDump, backupPath);
      } else {
        await fs.writeFile(backupPath, sqlDump, 'utf8');
      }

      const stats = await fs.stat(backupPath);
      
      const backupInfo: BackupInfo = {
        filename,
        createdAt: new Date(),
        size: stats.size,
        compressed: options.compress,
        encrypted: !!options.encryptionPassword,
        tables
      };

      // Log backup creation
      await this.dbService.run(
        'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
        [
          null,
          'system_backup',
          JSON.stringify({
            backup_file: filename,
            backup_size: stats.size,
            table_count: tables.length,
            compressed: options.compress,
            include_data: options.includeData
          })
        ]
      );

      logger.info('Database backup completed', {
        filename,
        size: stats.size,
        tableCount: tables.length
      });

      return backupInfo;

    } catch (error) {
      logger.error('Database backup failed', error);
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<void> {
    try {
      logger.info('Starting database restore', {
        source: options.source,
        overwrite: options.overwrite
      });

      // Check if backup file exists
      const stats = await fs.stat(options.source);
      if (!stats.isFile()) {
        throw new Error('Backup file does not exist');
      }

      // Read backup content
      let sqlContent: string;
      if (options.source.endsWith('.gz')) {
        sqlContent = await this.readCompressedBackup(options.source);
      } else {
        sqlContent = await fs.readFile(options.source, 'utf8');
      }

      // Parse and validate SQL content
      const statements = this.parseSQLStatements(sqlContent);
      
      if (statements.length === 0) {
        throw new Error('No valid SQL statements found in backup');
      }

      // Begin transaction for restore
      await this.dbService.transaction(async (trx) => {
        if (options.overwrite) {
          // Drop existing tables
          const existingTables = await this.getTables();
          for (const table of existingTables) {
            if (table !== 'sqlite_sequence') {
              await trx.query(`DROP TABLE IF EXISTS ${table}`);
            }
          }
        }

        // Execute SQL statements
        for (const statement of statements) {
          if (statement.trim()) {
            await trx.query(statement);
          }
        }
      });

      // Log restore completion
      await this.dbService.run(
        'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
        [
          null,
          'system_restore',
          JSON.stringify({
            backup_source: path.basename(options.source),
            backup_size: stats.size,
            statement_count: statements.length,
            overwrite: options.overwrite
          })
        ]
      );

      logger.info('Database restore completed', {
        source: options.source,
        statementCount: statements.length
      });

    } catch (error) {
      logger.error('Database restore failed', error);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * List available backups in a directory
   */
  async listBackups(backupDirectory: string): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(backupDirectory);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.startsWith('pcr-backup-') && (file.endsWith('.sql') || file.endsWith('.sql.gz'))) {
          const filePath = path.join(backupDirectory, file);
          const stats = await fs.stat(filePath);
          
          // Extract timestamp from filename
          const timestampMatch = file.match(/pcr-backup-(.+)\.sql/);
          const timestamp = timestampMatch ? timestampMatch[1].replace(/-/g, ':') : null;
          
          const backupInfo: BackupInfo = {
            filename: file,
            createdAt: timestamp ? new Date(timestamp.replace(/-/g, ':')) : stats.mtime,
            size: stats.size,
            compressed: file.endsWith('.gz'),
            encrypted: false, // Would need to inspect file to determine
            tables: [] // Would need to read file to determine
          };

          backups.push(backupInfo);
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
      logger.error('Failed to list backups', error);
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(backupDirectory: string, retentionDays: number = 30): Promise<number> {
    try {
      const backups = await this.listBackups(backupDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          const filePath = path.join(backupDirectory, backup.filename);
          await fs.unlink(filePath);
          deletedCount++;
          
          logger.info('Old backup deleted', {
            filename: backup.filename,
            age: Math.floor((Date.now() - backup.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          });
        }
      }

      if (deletedCount > 0) {
        await this.dbService.run(
          'INSERT INTO logs (user_id, action, timestamp, details) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
          [
            null,
            'system_cleanup',
            JSON.stringify({
              operation: 'backup_cleanup',
              deleted_count: deletedCount,
              retention_days: retentionDays
            })
          ]
        );
      }

      logger.info('Backup cleanup completed', {
        deletedCount,
        retentionDays
      });

      return deletedCount;

    } catch (error) {
      logger.error('Backup cleanup failed', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if file exists
      const stats = await fs.stat(backupPath);
      if (!stats.isFile()) {
        errors.push('Backup file does not exist');
        return { valid: false, errors };
      }

      // Read backup content
      let sqlContent: string;
      if (backupPath.endsWith('.gz')) {
        sqlContent = await this.readCompressedBackup(backupPath);
      } else {
        sqlContent = await fs.readFile(backupPath, 'utf8');
      }

      // Basic validation
      if (!sqlContent || sqlContent.trim().length === 0) {
        errors.push('Backup file is empty');
      }

      // Check for required tables
      const requiredTables = ['users', 'drafts', 'submissions', 'logs'];
      for (const table of requiredTables) {
        if (!sqlContent.includes(`CREATE TABLE ${table}`) && !sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          errors.push(`Missing table: ${table}`);
        }
      }

      // Check for SQL syntax issues (basic check)
      const statements = this.parseSQLStatements(sqlContent);
      if (statements.length === 0) {
        errors.push('No valid SQL statements found');
      }

      // Look for potential corruption indicators
      if (sqlContent.includes('SQLITE_CORRUPT') || sqlContent.includes('database disk image is malformed')) {
        errors.push('Backup shows signs of corruption');
      }

    } catch (error) {
      errors.push(`Verification error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create automated backup with scheduling
   */
  async scheduleBackup(
    options: BackupOptions,
    intervalHours: number = 24
  ): Promise<NodeJS.Timeout> {
    logger.info('Scheduling automated backups', {
      intervalHours,
      destination: options.destination
    });

    const intervalMs = intervalHours * 60 * 60 * 1000;

    return setInterval(async () => {
      try {
        await this.createBackup(options);
        
        // Cleanup old backups
        await this.cleanupOldBackups(options.destination);
        
      } catch (error) {
        logger.error('Scheduled backup failed', error);
      }
    }, intervalMs);
  }

  /**
   * Get database tables
   */
  private async getTables(): Promise<string[]> {
    const tables = await this.dbService.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    return tables.map(table => table.name);
  }

  /**
   * Generate SQL dump
   */
  private async generateSQLDump(tables: string[], includeData: boolean): Promise<string> {
    let dump = '-- PCR Application Database Backup\n';
    dump += `-- Created: ${new Date().toISOString()}\n`;
    dump += `-- Include Data: ${includeData}\n\n`;

    dump += 'PRAGMA foreign_keys=OFF;\n';
    dump += 'BEGIN TRANSACTION;\n\n';

    for (const table of tables) {
      // Get table schema
      const schema = await this.dbService.queryOne<{ sql: string }>(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name=?
      `, [table]);

      if (schema && schema.sql) {
        dump += `${schema.sql};\n\n`;

        if (includeData) {
          // Get table data
          const rows = await this.dbService.query(`SELECT * FROM ${table}`);
          
          if (rows.length > 0) {
            // Get column names
            const columns = Object.keys(rows[0]);
            
            for (const row of rows) {
              const values = columns.map(col => {
                const value = (row as any)[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
                return value;
              });
              
              dump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            dump += '\n';
          }
        }
      }
    }

    dump += 'COMMIT;\n';
    dump += 'PRAGMA foreign_keys=ON;\n';

    return dump;
  }

  /**
   * Write compressed backup
   */
  private async writeCompressedBackup(content: string, filePath: string): Promise<void> {
    const readStream = require('stream').Readable.from([content]);
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip({ level: 9 });

    await pipeline(readStream, gzipStream, writeStream);
  }

  /**
   * Read compressed backup
   */
  private async readCompressedBackup(filePath: string): Promise<string> {
    const chunks: Buffer[] = [];
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();

    await pipeline(
      readStream,
      gunzipStream,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk);
          yield chunk;
        }
      }
    );

    return Buffer.concat(chunks).toString('utf8');
  }

  /**
   * Parse SQL statements from dump
   */
  private parseSQLStatements(sqlContent: string): string[] {
    // Simple SQL statement parser
    // Note: This is basic and may not handle all edge cases
    return sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => 
        statement && 
        !statement.startsWith('--') && 
        statement.length > 0
      );
  }

  /**
   * Export specific table as CSV
   */
  async exportTableAsCSV(tableName: string, outputPath: string): Promise<void> {
    try {
      // Validate table exists
      const tables = await this.getTables();
      if (!tables.includes(tableName)) {
        throw new Error(`Table '${tableName}' does not exist`);
      }

      // Get table data
      const rows = await this.dbService.query(`SELECT * FROM ${tableName}`);
      
      if (rows.length === 0) {
        throw new Error(`Table '${tableName}' is empty`);
      }

      // Generate CSV content
      const columns = Object.keys(rows[0]);
      const csvRows = [columns.join(',')];

      for (const row of rows) {
        const values = columns.map(col => {
          const value = (row as any)[col];
          if (value === null) return '';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      await fs.writeFile(outputPath, csvContent, 'utf8');

      logger.info('Table exported as CSV', {
        table: tableName,
        rowCount: rows.length,
        outputPath
      });

    } catch (error) {
      logger.error('CSV export failed', error);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }
}