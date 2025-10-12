import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'pcr_database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export class DatabaseManager {
  private database: Database.Database;

  constructor() {
    this.database = new Database(DB_PATH);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = NORMAL');
    this.database.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.database.exec(schema);
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