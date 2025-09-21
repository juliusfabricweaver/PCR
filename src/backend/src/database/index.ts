import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

// In production, use a proper location for the database
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use the home directory for production database
    const dataDir = path.join(os.homedir(), '.pcr-app');

    // Create directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return path.join(dataDir, 'pcr_database.db');
  }
  return path.join(process.cwd(), 'pcr_database.db');
};

const DB_PATH = getDbPath();
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

console.log('Database path:', DB_PATH);
console.log('Schema path:', SCHEMA_PATH);

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.db.exec(schema);
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

const dbManager = new DatabaseManager();
export const db: Database.Database = dbManager.getDb();
export default db;