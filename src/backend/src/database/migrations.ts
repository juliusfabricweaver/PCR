/**
 * Database migration system for PCR application
 * Handles schema versioning and automatic updates
 */

import { Database } from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../services/logger';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down?: string;
}

export class MigrationManager {
  private db: Database;
  private migrationsPath: string;

  constructor(db: Database, migrationsPath?: string) {
    this.db = db;
    this.migrationsPath = migrationsPath || path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrations(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(sql, (err) => {
        if (err) {
          logger.error('Failed to initialize migrations table:', err);
          reject(err);
        } else {
          logger.info('Migration tracking table initialized');
          resolve();
        }
      });
    });
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT version FROM migrations ORDER BY executed_at ASC';
      
      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          logger.error('Failed to get executed migrations:', err);
          reject(err);
        } else {
          const versions = rows.map(row => row.version);
          resolve(versions);
        }
      });
    });
  }

  /**
   * Record a migration as executed
   */
  async recordMigration(version: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO migrations (version, name) VALUES (?, ?)';
      
      this.db.run(sql, [version, name], (err) => {
        if (err) {
          logger.error(`Failed to record migration ${version}:`, err);
          reject(err);
        } else {
          logger.info(`Migration ${version} recorded successfully`);
          resolve();
        }
      });
    });
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Executing migration: ${migration.version} - ${migration.name}`);
      
      this.db.exec(migration.up, (err) => {
        if (err) {
          logger.error(`Migration ${migration.version} failed:`, err);
          reject(err);
        } else {
          logger.info(`Migration ${migration.version} completed successfully`);
          resolve();
        }
      });
    });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      await this.initializeMigrations();
      
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = await this.getAvailableMigrations();
      
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to execute');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute migrations in order
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
        await this.recordMigration(migration.version, migration.name);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration execution failed:', error);
      throw error;
    }
  }

  /**
   * Get available migration files
   */
  private async getAvailableMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    
    // For now, we'll define migrations inline
    // In a production system, you might read from files
    migrations.push({
      version: '1.0.0',
      name: 'Initial schema setup',
      up: await this.readSchemaFile()
    });

    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Read the main schema file
   */
  private async readSchemaFile(): Promise<string> {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      return await fs.readFile(schemaPath, 'utf-8');
    } catch (error) {
      logger.error('Failed to read schema file:', error);
      throw new Error('Schema file not found or unreadable');
    }
  }

  /**
   * Get current database version
   */
  async getCurrentVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT version FROM migrations ORDER BY executed_at DESC LIMIT 1';
      
      this.db.get(sql, (err, row: any) => {
        if (err) {
          logger.error('Failed to get current version:', err);
          reject(err);
        } else {
          resolve(row ? row.version : '0.0.0');
        }
      });
    });
  }

  /**
   * Create a new migration
   */
  createMigration(version: string, name: string, upSql: string, downSql?: string): Migration {
    return {
      version,
      name,
      up: upSql,
      down: downSql
    };
  }

  /**
   * Rollback the last migration (if down script is available)
   */
  async rollbackLastMigration(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT version, name FROM migrations 
        ORDER BY executed_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, async (err, row: any) => {
        if (err) {
          logger.error('Failed to get last migration:', err);
          reject(err);
          return;
        }

        if (!row) {
          logger.info('No migrations to rollback');
          resolve();
          return;
        }

        const migrations = await this.getAvailableMigrations();
        const migration = migrations.find(m => m.version === row.version);

        if (!migration || !migration.down) {
          logger.error(`Cannot rollback migration ${row.version}: no down script`);
          reject(new Error('Rollback not possible'));
          return;
        }

        // Execute rollback
        this.db.exec(migration.down, (execErr) => {
          if (execErr) {
            logger.error(`Rollback of ${row.version} failed:`, execErr);
            reject(execErr);
          } else {
            // Remove from migrations table
            const deleteSql = 'DELETE FROM migrations WHERE version = ?';
            this.db.run(deleteSql, [row.version], (deleteErr) => {
              if (deleteErr) {
                logger.error(`Failed to remove migration record:`, deleteErr);
                reject(deleteErr);
              } else {
                logger.info(`Successfully rolled back migration: ${row.version}`);
                resolve();
              }
            });
          }
        });
      });
    });
  }

  /**
   * Seed initial data (admin user, etc.)
   */
  async seedInitialData(adminUsername: string, adminPassword: string): Promise<void> {
    const bcrypt = await import('bcrypt');
    
    return new Promise((resolve, reject) => {
      // Check if admin user already exists
      const checkSql = 'SELECT id FROM users WHERE role = ? LIMIT 1';
      
      this.db.get(checkSql, ['admin'], async (err, row) => {
        if (err) {
          logger.error('Failed to check for admin user:', err);
          reject(err);
          return;
        }

        if (row) {
          logger.info('Admin user already exists, skipping seeding');
          resolve();
          return;
        }

        try {
          // Hash password
          const saltRounds = 12;
          const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

          // Create admin user
          const insertSql = `
            INSERT INTO users (username, password_hash, role, created_at, updated_at)
            VALUES (?, ?, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;

          this.db.run(insertSql, [adminUsername, hashedPassword], function(insertErr) {
            if (insertErr) {
              logger.error('Failed to create admin user:', insertErr);
              reject(insertErr);
            } else {
              logger.info(`Admin user created successfully with ID: ${this.lastID}`);
              
              // Log the creation
              const logSql = `
                INSERT INTO logs (user_id, action, details, timestamp)
                VALUES (?, 'user_created', ?, CURRENT_TIMESTAMP)
              `;
              
              const logDetails = JSON.stringify({
                created_user: adminUsername,
                created_role: 'admin',
                created_by: 'system'
              });

              this.db.run(logSql, [this.lastID, logDetails], (logErr) => {
                if (logErr) {
                  logger.warn('Failed to log admin user creation:', logErr);
                }
                resolve();
              });
            }
          });
        } catch (hashErr) {
          logger.error('Failed to hash admin password:', hashErr);
          reject(hashErr);
        }
      });
    });
  }
}