import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Electron environment detection
const isElectron = process.env.IS_ELECTRON === 'true';

// Database path: Use env var if in Electron, otherwise use current working directory
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'pcr_database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Statement wrapper to mimic better-sqlite3 API
class StatementWrapper {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  get(...params: any[]): any {
    try {
      const stmt = this.db.prepare(this.sql);
      stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);

      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: any = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    } catch (error) {
      console.error('SQL get error:', error, 'SQL:', this.sql);
      throw error;
    }
  }

  all(...params: any[]): any[] {
    try {
      const stmt = this.db.prepare(this.sql);
      stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);

      const results: any[] = [];
      const columns = stmt.getColumnNames();

      while (stmt.step()) {
        const values = stmt.get();
        const row: any = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        results.push(row);
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error('SQL all error:', error, 'SQL:', this.sql);
      throw error;
    }
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    try {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      this.db.run(this.sql, flatParams);

      // Get changes and last insert rowid
      const changesResult = this.db.exec('SELECT changes() as changes, last_insert_rowid() as lastId');
      const changes = changesResult[0]?.values[0]?.[0] as number || 0;
      const lastInsertRowid = changesResult[0]?.values[0]?.[1] as number || 0;

      return { changes, lastInsertRowid };
    } catch (error) {
      console.error('SQL run error:', error, 'SQL:', this.sql, 'Params:', params);
      throw error;
    }
  }
}

// Database wrapper to mimic better-sqlite3 API
class DatabaseWrapper {
  private db: SqlJsDatabase;
  private dbPath: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.db, sql);
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.scheduleSave();
  }

  pragma(statement: string): any {
    const result = this.db.exec(`PRAGMA ${statement}`);
    this.scheduleSave();
    return result;
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveToFile();
    this.db.close();
  }

  // Save database to file (debounced)
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveToFile();
    }, 1000); // Save after 1 second of inactivity
  }

  saveToFile(): void {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // Expose the raw db for the wrapper's run method to trigger saves
  getRawDb(): SqlJsDatabase {
    return this.db;
  }

  triggerSave(): void {
    this.scheduleSave();
  }
}

// Extend StatementWrapper to trigger saves after mutations
const originalRun = StatementWrapper.prototype.run;
StatementWrapper.prototype.run = function(...params: any[]) {
  const result = originalRun.apply(this, params);
  // @ts-ignore - accessing private for save trigger
  if (dbWrapper) {
    dbWrapper.triggerSave();
  }
  return result;
};

let dbWrapper: DatabaseWrapper | null = null;

export class DatabaseManager {
  private database: DatabaseWrapper | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize sql.js
      const SQL = await initSqlJs();

      // Load existing database or create new one
      let db: SqlJsDatabase;
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('Loaded existing database from:', DB_PATH);
      } else {
        db = new SQL.Database();
        console.log('Created new database');
      }

      this.database = new DatabaseWrapper(db, DB_PATH);
      dbWrapper = this.database;

      // Set pragmas
      this.database.pragma('journal_mode = WAL');
      this.database.pragma('synchronous = NORMAL');
      this.database.pragma('foreign_keys = ON');

      // Initialize schema
      this.initializeSchema();
      this.runMigrations();

      // Create default users if none exist
      await this.createDefaultUsers();

      // Save initial state
      this.database.saveToFile();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private initializeSchema(): void {
    if (!this.database) return;
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.database.exec(schema);
  }

  private runMigrations(): void {
    if (!this.database) return;

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

  private async createDefaultUsers(): Promise<void> {
    if (!this.database) return;

    try {
      // Check if any users exist
      const existingUsers = this.database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

      if (existingUsers.count === 0) {
        console.log('No users found, creating default accounts...');

        const generateId = () => 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Create admin user
        const adminHash = await bcrypt.hash('vcrt-ebic2026!', 10);
        this.database.prepare(`
          INSERT INTO users (id, username, password_hash, first_name, last_name, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(generateId(), 'admin', adminHash, 'System', 'Administrator', 'admin', 1);
        console.log('Created admin user (admin/vcrt-ebic2026!)');

        // Create regular user
        const userHash = await bcrypt.hash('user', 10);
        this.database.prepare(`
          INSERT INTO users (id, username, password_hash, first_name, last_name, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(generateId(), 'user', userHash, 'Regular', 'User', 'user', 1);
        console.log('Created regular user (user/user)');

        // Save immediately
        this.database.saveToFile();
      }
    } catch (error) {
      console.error('Error creating default users:', error);
    }
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  getDb(): DatabaseWrapper {
    if (!this.database) {
      throw new Error('Database not initialized. Call waitForInit() first.');
    }
    return this.database;
  }

  close(): void {
    if (this.database) {
      this.database.close();
    }
  }
}

// Create manager instance
const dbManager = new DatabaseManager();

// For synchronous access (after init), create a proxy that waits for init
const dbProxy = new Proxy({} as DatabaseWrapper, {
  get(target, prop) {
    const db = dbManager.getDb();
    const value = (db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  }
});

// Export functions
export function getDatabase(): DatabaseWrapper {
  return dbManager.getDb();
}

export async function initDatabase(): Promise<void> {
  await dbManager.waitForInit();
}

// For backwards compatibility
export default dbProxy;
