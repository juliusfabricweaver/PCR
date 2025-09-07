/**
 * Database service with connection pooling, prepared statements, and transaction support
 * Implements repository pattern for data access
 */

import { Database, Statement } from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { EventEmitter } from 'events';
import { DatabaseConfig, QueryOptions, WhereClause, DatabaseTransaction } from '../types';
import { logger } from '../services/logger';
import { MigrationManager } from './migrations';

export class DatabaseService extends EventEmitter {
  private db: Database | null = null;
  private isConnected: boolean = false;
  private connectionPool: Database[] = [];
  private config: DatabaseConfig;
  private preparedStatements: Map<string, Statement> = new Map();
  private migrationManager: MigrationManager | null = null;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize database connection and setup
   */
  async connect(): Promise<void> {
    try {
      await this.createConnection();
      await this.setupDatabase();
      await this.runMigrations();
      
      this.isConnected = true;
      this.emit('connected');
      logger.info('Database service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Create database connection with proper configuration
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbPath = path.resolve(this.config.filename);
      logger.info(`Connecting to database at: ${dbPath}`);

      this.db = new Database(dbPath, (err) => {
        if (err) {
          logger.error('Database connection failed:', err);
          reject(err);
        } else {
          logger.info('Database connection established');
          resolve();
        }
      });

      // Configure database settings
      this.db.configure('busyTimeout', this.config.busyTimeout);
      
      // Enable foreign keys
      if (this.config.enableForeignKeys) {
        this.db.run('PRAGMA foreign_keys = ON');
      }

      // Set WAL mode for better performance
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
      this.db.run('PRAGMA temp_store = memory');
    });
  }

  /**
   * Setup database with optimization settings
   */
  private async setupDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      const setupQueries = [
        'PRAGMA foreign_keys = ON',
        'PRAGMA journal_mode = WAL',
        'PRAGMA synchronous = NORMAL',
        'PRAGMA temp_store = memory',
        'PRAGMA mmap_size = 268435456', // 256MB
        'PRAGMA cache_size = -64000', // 64MB cache
        'PRAGMA optimize'
      ];

      let completed = 0;
      const total = setupQueries.length;

      setupQueries.forEach((query) => {
        this.db!.run(query, (err) => {
          if (err) {
            logger.error(`Failed to execute setup query: ${query}`, err);
            reject(err);
            return;
          }

          completed++;
          if (completed === total) {
            logger.info('Database setup completed');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    this.migrationManager = new MigrationManager(this.db);
    await this.migrationManager.runMigrations();
  }

  /**
   * Seed initial data (admin user)
   */
  async seedData(adminUsername: string, adminPassword: string): Promise<void> {
    if (!this.migrationManager) throw new Error('Migration manager not initialized');
    
    await this.migrationManager.seedInitialData(adminUsername, adminPassword);
  }

  /**
   * Execute a query with parameters
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.db!.all(sql, params || [], (err, rows: T[]) => {
        const duration = Date.now() - startTime;

        if (err) {
          logger.error('Database query failed:', { sql, params, error: err.message, duration });
          reject(err);
        } else {
          logger.debug('Database query executed:', { 
            sql: sql.substring(0, 100) + '...', 
            rowCount: rows.length, 
            duration 
          });
          resolve(rows);
        }
      });
    });
  }

  /**
   * Execute a single row query
   */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   */
  async run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.db!.run(sql, params || [], function(err) {
        const duration = Date.now() - startTime;

        if (err) {
          logger.error('Database run failed:', { sql, params, error: err.message, duration });
          reject(err);
        } else {
          logger.debug('Database run executed:', { 
            sql: sql.substring(0, 100) + '...', 
            lastID: this.lastID, 
            changes: this.changes, 
            duration 
          });
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Prepare a statement for reuse
   */
  async prepare(sql: string, key?: string): Promise<Statement> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    const statementKey = key || sql;

    if (this.preparedStatements.has(statementKey)) {
      return this.preparedStatements.get(statementKey)!;
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(sql, (err) => {
        if (err) {
          logger.error('Failed to prepare statement:', { sql, error: err.message });
          reject(err);
        } else {
          this.preparedStatements.set(statementKey, stmt);
          logger.debug('Statement prepared:', { key: statementKey });
          resolve(stmt);
        }
      });
    });
  }

  /**
   * Execute a prepared statement
   */
  async executePrepared<T = any>(key: string, params?: any[]): Promise<T[]> {
    const stmt = this.preparedStatements.get(key);
    if (!stmt) {
      throw new Error(`Prepared statement not found: ${key}`);
    }

    return new Promise((resolve, reject) => {
      stmt.all(params || [], (err, rows: T[]) => {
        if (err) {
          logger.error('Prepared statement execution failed:', { key, params, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Begin a database transaction
   */
  async beginTransaction(): Promise<DatabaseTransaction> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    await this.run('BEGIN TRANSACTION');

    return {
      commit: async (): Promise<void> => {
        await this.run('COMMIT');
      },
      rollback: async (): Promise<void> => {
        await this.run('ROLLBACK');
      },
      query: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
        return this.query<T>(sql, params);
      }
    };
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(callback: (trx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const trx = await this.beginTransaction();
    
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Build WHERE clause from object
   */
  private buildWhereClause(where: WhereClause): { sql: string; params: any[] } {
    if (!where || Object.keys(where).length === 0) {
      return { sql: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (typeof value === 'object' && value.operator) {
        conditions.push(`${key} ${value.operator} ?`);
        params.push(value.value);
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    return {
      sql: `WHERE ${conditions.join(' AND ')}`,
      params
    };
  }

  /**
   * Generic find method with query options
   */
  async find<T = any>(tableName: string, options: QueryOptions = {}): Promise<T[]> {
    let sql = `SELECT * FROM ${tableName}`;
    let params: any[] = [];

    if (options.where) {
      const whereClause = this.buildWhereClause(options.where);
      sql += ` ${whereClause.sql}`;
      params = whereClause.params;
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.query<T>(sql, params);
  }

  /**
   * Generic find one method
   */
  async findOne<T = any>(tableName: string, options: QueryOptions = {}): Promise<T | null> {
    const results = await this.find<T>(tableName, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Generic count method
   */
  async count(tableName: string, options: QueryOptions = {}): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    let params: any[] = [];

    if (options.where) {
      const whereClause = this.buildWhereClause(options.where);
      sql += ` ${whereClause.sql}`;
      params = whereClause.params;
    }

    const result = await this.queryOne<{ count: number }>(sql, params);
    return result ? result.count : 0;
  }

  /**
   * Cleanup expired records
   */
  async cleanupExpired(): Promise<void> {
    const queries = [
      'DELETE FROM drafts WHERE expires_at < CURRENT_TIMESTAMP',
      'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP',
      'DELETE FROM login_attempts WHERE attempted_at < datetime("now", "-24 hours") AND success = 0'
    ];

    for (const query of queries) {
      try {
        const result = await this.run(query);
        if (result.changes > 0) {
          logger.info(`Cleaned up ${result.changes} expired records with query: ${query}`);
        }
      } catch (error) {
        logger.error('Failed to cleanup expired records:', error);
      }
    }
  }

  /**
   * Backup database to a file
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const backup = this.db!.backup(backupPath);
      
      backup.step(-1, (err) => {
        if (err) {
          logger.error('Database backup failed:', err);
          reject(err);
        } else {
          backup.finish((finishErr) => {
            if (finishErr) {
              logger.error('Database backup finish failed:', finishErr);
              reject(finishErr);
            } else {
              logger.info(`Database backed up to: ${backupPath}`);
              resolve();
            }
          });
        }
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    const stats = {
      users: await this.count('users'),
      drafts: await this.count('drafts'),
      submissions: await this.count('submissions'),
      logs: await this.count('logs'),
      sessions: await this.count('sessions')
    };

    return stats;
  }

  /**
   * Close database connection and cleanup
   */
  async close(): Promise<void> {
    if (!this.db) return;

    // Close prepared statements
    for (const [key, stmt] of this.preparedStatements) {
      stmt.finalize((err) => {
        if (err) {
          logger.warn(`Failed to finalize prepared statement ${key}:`, err);
        }
      });
    }
    this.preparedStatements.clear();

    // Close database connection
    return new Promise((resolve) => {
      this.db!.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
        } else {
          logger.info('Database connection closed');
        }
        
        this.db = null;
        this.isConnected = false;
        this.emit('disconnected');
        resolve();
      });
    });
  }

  /**
   * Check if database is connected
   */
  isDBConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current database version
   */
  async getVersion(): Promise<string> {
    if (!this.migrationManager) return '0.0.0';
    return this.migrationManager.getCurrentVersion();
  }
}