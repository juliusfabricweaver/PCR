/**
 * Logging service using Winston with daily rotation and structured logging
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface LogConfig {
  level: string;
  maxFiles: number;
  maxSize: string;
  datePattern: string;
  logDir?: string;
}

class LoggerService {
  private logger!: winston.Logger;
  private config: LogConfig;

  constructor(config: LogConfig) {
    this.config = config;
    this.setupLogger();
  }

  private setupLogger(): void {
    // Ensure log directory exists
    const logDir = this.config.logDir || path.join(process.cwd(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Custom format for structured logging
    const customFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          message,
          ...meta
        };
        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length > 0 ? 
          `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} ${level}: ${message}${metaString}`;
      })
    );

    // Create transports
    const transports: winston.transport[] = [];

    // Console transport (always enabled in development)
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          level: this.config.level,
          format: consoleFormat
        })
      );
    }

    // File transport for all logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'app-%DATE%.log'),
        datePattern: this.config.datePattern,
        maxFiles: this.config.maxFiles,
        maxSize: this.config.maxSize,
        level: this.config.level,
        format: customFormat,
        auditFile: path.join(logDir, 'audit.json'),
        createSymlink: true,
        symlinkName: 'app-current.log'
      })
    );

    // Error-only file transport
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: this.config.datePattern,
        maxFiles: this.config.maxFiles,
        maxSize: this.config.maxSize,
        level: 'error',
        format: customFormat,
        auditFile: path.join(logDir, 'error-audit.json'),
        createSymlink: true,
        symlinkName: 'error-current.log'
      })
    );

    // Security events file transport
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'security-%DATE%.log'),
        datePattern: this.config.datePattern,
        maxFiles: this.config.maxFiles,
        maxSize: this.config.maxSize,
        level: 'info',
        format: customFormat,
        auditFile: path.join(logDir, 'security-audit.json'),
        createSymlink: true,
        symlinkName: 'security-current.log'
      })
    );

    // Create logger instance
    this.logger = winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log'),
          format: customFormat
        })
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log'),
          format: customFormat
        })
      ]
    });

    // Log startup
    this.logger.info('Logger initialized', {
      level: this.config.level,
      logDir,
      transports: transports.length
    });
  }

  // Standard logging methods
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...meta
      });
    } else if (error && typeof error === 'object') {
      this.logger.error(message, { error, ...meta });
    } else {
      this.logger.error(message, { error, ...meta });
    }
  }

  // Security-specific logging methods
  security(message: string, meta?: any): void {
    this.logger.info(message, {
      category: 'security',
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  audit(action: string, userId?: number, details?: any): void {
    this.logger.info('Audit event', {
      category: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  access(method: string, url: string, statusCode: number, responseTime: number, userId?: number, ip?: string): void {
    this.logger.info('Access log', {
      category: 'access',
      method,
      url,
      statusCode,
      responseTime,
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  database(operation: string, table?: string, duration?: number, error?: Error): void {
    if (error) {
      this.logger.error('Database operation failed', {
        category: 'database',
        operation,
        table,
        duration,
        error: {
          name: error.name,
          message: error.message
        }
      });
    } else {
      this.logger.debug('Database operation', {
        category: 'database',
        operation,
        table,
        duration
      });
    }
  }

  performance(operation: string, duration: number, meta?: any): void {
    this.logger.info('Performance metric', {
      category: 'performance',
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Authentication and authorization logging
  authSuccess(username: string, userId: number, ip?: string, userAgent?: string): void {
    this.security('Authentication successful', {
      event: 'auth_success',
      username,
      userId,
      ip,
      userAgent
    });
  }

  authFailure(username: string, reason: string, ip?: string, attempts?: number): void {
    this.security('Authentication failed', {
      event: 'auth_failure',
      username,
      reason,
      ip,
      attempts
    });
  }

  authLockout(username: string, ip?: string, attempts?: number, lockoutDuration?: number): void {
    this.security('Account locked due to failed authentication attempts', {
      event: 'auth_lockout',
      username,
      ip,
      attempts,
      lockoutDuration
    });
  }

  sessionCreated(userId: number, sessionId: string, ip?: string): void {
    this.security('Session created', {
      event: 'session_created',
      userId,
      sessionId,
      ip
    });
  }

  sessionExpired(userId: number, sessionId: string): void {
    this.security('Session expired', {
      event: 'session_expired',
      userId,
      sessionId
    });
  }

  // Data access logging
  dataAccess(userId: number, operation: string, resource: string, resourceId?: number | string): void {
    this.audit('data_access', userId, {
      operation,
      resource,
      resourceId
    });
  }

  dataModification(userId: number, operation: string, resource: string, resourceId?: number | string, changes?: any): void {
    this.audit('data_modification', userId, {
      operation,
      resource,
      resourceId,
      changes
    });
  }

  // System events
  systemStart(): void {
    this.info('System started', {
      category: 'system',
      event: 'startup',
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    });
  }

  systemShutdown(): void {
    this.info('System shutting down', {
      category: 'system',
      event: 'shutdown',
      uptime: process.uptime(),
      pid: process.pid
    });
  }

  systemError(error: Error, context?: string): void {
    this.error('System error occurred', error, {
      category: 'system',
      context,
      pid: process.pid,
      memory: process.memoryUsage()
    });
  }

  // Configuration logging
  configLoaded(configSource: string, keys?: string[]): void {
    this.info('Configuration loaded', {
      category: 'config',
      source: configSource,
      keys: keys || []
    });
  }

  configError(error: Error, configSource?: string): void {
    this.error('Configuration error', error, {
      category: 'config',
      source: configSource
    });
  }

  // Request/Response logging with sanitization
  httpRequest(req: any, res?: any, responseTime?: number): void {
    const sanitizedHeaders = { ...req.headers };
    delete sanitizedHeaders.authorization;
    delete sanitizedHeaders.cookie;
    
    this.access(
      req.method,
      req.originalUrl || req.url,
      res?.statusCode || 0,
      responseTime || 0,
      req.user?.id,
      req.ip
    );
  }

  // Error logging with context
  apiError(error: Error, req?: any, context?: any): void {
    this.error('API error', error, {
      category: 'api',
      method: req?.method,
      url: req?.originalUrl || req?.url,
      userId: req?.user?.id,
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      ...context
    });
  }

  // Log structured query information (without sensitive data)
  queryLog(query: string, _params?: any[], duration?: number, error?: Error): void {
    // Sanitize query for logging (remove sensitive data)
    query.replace(/VALUES\s*\([^)]*\)/gi, 'VALUES (...)');
    
    if (error) {
      this.database('query_failed', undefined, duration, error);
    } else {
      this.database('query_executed', undefined, duration);
    }
  }

  // Get logger instance for advanced usage
  getLogger(): winston.Logger {
    return this.logger;
  }

  // Change log level at runtime
  setLevel(level: string): void {
    this.logger.level = level;
    this.info('Log level changed', { newLevel: level });
  }

  // Get current configuration
  getConfig(): LogConfig {
    return { ...this.config };
  }

  // Close logger and flush logs
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.info('Logger shutting down');
      this.logger.end(() => {
        resolve();
      });
    });
  }
}

// Default configuration
const defaultConfig: LogConfig = {
  level: process.env.LOG_LEVEL || 'info',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
};

// Create singleton logger instance
export const logger = new LoggerService(defaultConfig);

// Export logger service class for custom instances
export { LoggerService };