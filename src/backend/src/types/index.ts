/**
 * Core type definitions for the PCR application backend
 */

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreateData {
  username: string;
  password: string;
  role: UserRole;
}

export interface UserUpdateData {
  username?: string;
  password?: string;
  role?: UserRole;
}

export interface Draft {
  id: number;
  user_id: number;
  data_encrypted: Buffer;
  created_at: Date;
  expires_at: Date;
}

export interface DraftData {
  user_id: number;
  data: Record<string, any>;
  expires_at?: Date;
}

export interface Submission {
  id: number;
  user_id: number;
  data: Record<string, any>;
  submitted_at: Date;
}

export interface SubmissionData {
  user_id: number;
  data: Record<string, any>;
}

export interface Log {
  id: number;
  user_id: number;
  action: LogAction;
  timestamp: Date;
  details?: string;
}

export interface LogData {
  user_id: number;
  action: LogAction;
  details?: string;
}

export type UserRole = 'admin' | 'user';

export type LogAction = 
  | 'login' 
  | 'logout' 
  | 'draft_saved' 
  | 'draft_loaded'
  | 'form_submitted' 
  | 'form_cleared'
  | 'user_created'
  | 'user_deleted'
  | 'failed_login'
  | 'account_locked'
  | 'session_expired';

export interface AuthPayload {
  userId: number;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: number;
    username: string;
    role: UserRole;
  };
  message?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface DatabaseConfig {
  filename: string;
  maxConnections: number;
  busyTimeout: number;
  enableForeignKeys: boolean;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  database: DatabaseConfig;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  encryption: {
    algorithm: string;
    keyDerivation: {
      iterations: number;
      keyLength: number;
      digest: string;
    };
  };
  security: {
    bcryptRounds: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  session: {
    timeout: number;
    warningTime: number;
  };
  logs: {
    level: string;
    maxFiles: number;
    maxSize: string;
    datePattern: string;
  };
}

export interface SessionData {
  userId: number;
  username: string;
  role: UserRole;
  loginTime: Date;
  lastActivity: Date;
  loginAttempts: number;
  lockedUntil?: Date;
}

export interface EncryptionResult {
  encrypted: Buffer;
  iv: Buffer;
  salt: Buffer;
  authTag: Buffer;
}

export interface DecryptionInput {
  encrypted: Buffer;
  iv: Buffer;
  salt: Buffer;
  authTag: Buffer;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

// Request extensions
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: UserRole;
  };
}

// Database query builders
export interface WhereClause {
  [key: string]: any;
}

export interface QueryOptions {
  where?: WhereClause;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
}