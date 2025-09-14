import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'pcr_database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

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

export const db = new DatabaseManager().getDb();
export default db;