/**
 * Custom error classes and error handling utilities
 */

import { logger } from '../services/logger';

export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: any;

  constructor(message: string, statusCode: number, isOperational: boolean = true, context?: any) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set the name to the class name
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context
    };
  }
}

// Authentication and Authorization Errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: any) {
    super(message, 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context?: any) {
    super(message, 403, true, context);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired', context?: any) {
    super(message, 401, true, context);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message: string = 'Invalid token', context?: any) {
    super(message, 401, true, context);
  }
}

export class AccountLockedError extends AppError {
  constructor(message: string = 'Account is temporarily locked', context?: any) {
    super(message, 423, true, context);
  }
}

// Validation Errors
export class ValidationError extends AppError {
  public readonly validationErrors: any[];

  constructor(message: string = 'Validation failed', validationErrors: any[] = [], context?: any) {
    super(message, 400, true, context);
    this.validationErrors = validationErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(fieldName: string, context?: any) {
    super(`Required field '${fieldName}' is missing`, [], context);
  }
}

export class InvalidFieldError extends ValidationError {
  constructor(fieldName: string, expectedType?: string, context?: any) {
    const message = expectedType 
      ? `Field '${fieldName}' is invalid. Expected: ${expectedType}`
      : `Field '${fieldName}' is invalid`;
    super(message, [], context);
  }
}

// Resource Errors
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', resourceId?: string | number, context?: any) {
    const message = resourceId 
      ? `${resource} with ID '${resourceId}' not found`
      : `${resource} not found`;
    super(message, 404, true, context);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', context?: any) {
    super(message, 409, true, context);
  }
}

export class DuplicateError extends ConflictError {
  constructor(resource: string, field: string, value: string, context?: any) {
    super(`${resource} with ${field} '${value}' already exists`, context);
  }
}

// Database Errors
export class DatabaseError extends AppError {
  public readonly operation?: string;
  public readonly table?: string;

  constructor(message: string = 'Database operation failed', operation?: string, table?: string, context?: any) {
    super(message, 500, true, context);
    this.operation = operation;
    this.table = table;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      table: this.table
    };
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string = 'Database connection failed', context?: any) {
    super(message, undefined, undefined, context);
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string = 'Transaction failed', operation?: string, context?: any) {
    super(message, operation, undefined, context);
  }
}

// Business Logic Errors
export class BusinessLogicError extends AppError {
  constructor(message: string, statusCode: number = 422, context?: any) {
    super(message, statusCode, true, context);
  }
}

export class DraftExpiredError extends BusinessLogicError {
  constructor(draftId: number, context?: any) {
    super(`Draft with ID '${draftId}' has expired`, 410, context);
  }
}

export class SessionExpiredError extends BusinessLogicError {
  constructor(message: string = 'Session has expired', context?: any) {
    super(message, 440, context); // Custom status code for session timeout
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number, context?: any) {
    super(message, 429, true, { retryAfter, ...context });
  }
}

// Encryption Errors
export class EncryptionError extends AppError {
  public readonly operation: 'encrypt' | 'decrypt';

  constructor(message: string, operation: 'encrypt' | 'decrypt', context?: any) {
    super(message, 500, true, context);
    this.operation = operation;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation
    };
  }
}

// File/Storage Errors
export class FileError extends AppError {
  public readonly filepath?: string;
  public readonly operation?: string;

  constructor(message: string, filepath?: string, operation?: string, context?: any) {
    super(message, 500, true, context);
    this.filepath = filepath;
    this.operation = operation;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      filepath: this.filepath,
      operation: this.operation
    };
  }
}

export class FileNotFoundError extends FileError {
  constructor(filepath: string, context?: any) {
    super(`File not found: ${filepath}`, filepath, 'read', context);
    this.statusCode = 404;
  }
}

// Configuration Errors
export class ConfigurationError extends AppError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: any) {
    super(message, 500, false, context); // Configuration errors are not operational
    this.configKey = configKey;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      configKey: this.configKey
    };
  }
}

// External Service Errors
export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly statusCode: number;

  constructor(message: string, service: string, statusCode: number = 503, context?: any) {
    super(message, statusCode, true, context);
    this.service = service;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      service: this.service
    };
  }
}

// Generic server errors
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', context?: any) {
    super(message, 500, true, context);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', context?: any) {
    super(message, 503, true, context);
  }
}

// Error creation helpers
export function createValidationError(errors: any[], message?: string): ValidationError {
  const formattedErrors = errors.map(err => {
    if (err.path && err.message) {
      return { field: err.path, message: err.message };
    }
    return err;
  });

  return new ValidationError(
    message || `Validation failed with ${errors.length} error(s)`,
    formattedErrors
  );
}

export function createDatabaseError(originalError: any, operation?: string, table?: string): DatabaseError {
  let message = 'Database operation failed';
  
  if (originalError.code === 'SQLITE_CONSTRAINT') {
    message = 'Database constraint violation';
    return new ConflictError(message, { originalError: originalError.message });
  } else if (originalError.code === 'SQLITE_BUSY') {
    message = 'Database is busy';
  } else if (originalError.code === 'SQLITE_LOCKED') {
    message = 'Database is locked';
  } else if (originalError.message) {
    message = originalError.message;
  }

  return new DatabaseError(message, operation, table, { 
    originalError: originalError.message || originalError,
    code: originalError.code 
  });
}

export function createAuthenticationError(reason: string, context?: any): AuthenticationError {
  const messages: { [key: string]: string } = {
    'invalid_credentials': 'Invalid username or password',
    'account_locked': 'Account is temporarily locked',
    'token_expired': 'Authentication token has expired',
    'token_invalid': 'Invalid authentication token',
    'session_expired': 'Session has expired'
  };

  const message = messages[reason] || 'Authentication failed';
  return new AuthenticationError(message, { reason, ...context });
}

// Error utilities
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

export function getErrorResponse(error: AppError) {
  return {
    success: false,
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
      ...(error.context && { context: error.context })
    }
  };
}

export function sanitizeError(error: any): any {
  // Remove sensitive information from errors before sending to client
  if (isAppError(error)) {
    const sanitized = { ...error.toJSON() };
    
    // Remove sensitive context data
    if (sanitized.context) {
      delete sanitized.context.password;
      delete sanitized.context.token;
      delete sanitized.context.secret;
      delete sanitized.context.key;
    }

    return sanitized;
  }

  return {
    name: 'Error',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString()
  };
}

// Error logging helper
export function logError(error: any, context?: any): void {
  if (isAppError(error)) {
    if (error.statusCode >= 500) {
      logger.error(`${error.name}: ${error.message}`, error, context);
    } else if (error.statusCode >= 400) {
      logger.warn(`${error.name}: ${error.message}`, { 
        statusCode: error.statusCode,
        context: error.context,
        ...context 
      });
    }
  } else {
    logger.error('Unexpected error occurred', error, context);
  }
}