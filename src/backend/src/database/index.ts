import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Electron environment detection
const isElectron = process.env.IS_ELECTRON === 'true';

// Database path: Use env var if in Electron, otherwise use current working directory
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'pcr_database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export class DatabaseManager {
  private database: Database.Database;

  constructor() {
    this.database = new Database(DB_PATH);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = NORMAL');
    this.database.pragma('foreign_keys = ON');
    this.initializeSchema();
    this.runMigrations();
  }

  private initializeSchema(): void {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.database.exec(schema);
  }

  private runMigrations(): void {
    // Migration: Add sign-off attachment columns if they don't exist
    try {
      const tableInfo = this.database.prepare('PRAGMA table_info(pcr_reports)').all() as Array<{ name: string }>;
      const columnNames = tableInfo.map(col => col.name);

      if (!columnNames.includes('sign_off_attachment')) {
        this.database.exec('ALTER TABLE pcr_reports ADD COLUMN sign_off_attachment TEXT');
        console.log('Migration: Added sign_off_attachment column to pcr_reports');
      }

      if (!columnNames.includes('sign_off_filename')) {
        this.database.exec('ALTER TABLE pcr_reports ADD COLUMN sign_off_filename TEXT');
        console.log('Migration: Added sign_off_filename column to pcr_reports');
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  getDb(): Database.Database {
    return this.database;
  }

  close(): void {
    this.database.close();
  }
}

// Create and export manager instance to avoid direct Database type export
const dbManager = new DatabaseManager();

// Export the database through a function to avoid type export issues
export function getDatabase(): Database.Database {
  return dbManager.getDb();
}

// For backwards compatibility, export a db object with explicit type
const db: any = dbManager.getDb();
export default db;