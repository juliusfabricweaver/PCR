/**
 * Error handling middleware for Express application
 */

import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  isAppError, 
  isOperationalError, 
  getErrorResponse, 
  sanitizeError, 
  logError,
  InternalServerError 
} from '../utils/errors';
import { logger } from '../services/logger';

// Error handling middleware
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log the error with request context
  logError(error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?.id,
    userAgent: req.get('User-Agent'),
    requestId: (req as any).requestId
  });

  // Handle operational errors
  if (isAppError(error)) {
    const errorResponse = getErrorResponse(error);
    const sanitizedError = sanitizeError(error);
    
    res.status(error.statusCode).json({
      ...errorResponse,
      error: sanitizedError
    });
    return;
  }

  // Handle known error types that aren't AppError instances
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        name: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        details: (error as any).details || error.message
      }
    });
    return;
  }

  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        name: 'AuthenticationError',
        message: 'Invalid token',
        statusCode: 401,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        name: 'TokenExpiredError',
        message: 'Token has expired',
        statusCode: 401,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle unexpected errors
  logger.error('Unhandled error occurred', error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?.id
  });

  // Create an internal server error
  const internalError = new InternalServerError('An unexpected error occurred', {
    originalError: error.message,
    stack: error.stack
  });

  const errorResponse = getErrorResponse(internalError);
  const sanitizedError = sanitizeError(internalError);

  res.status(500).json({
    ...errorResponse,
    error: sanitizedError
  });
}

// Async error handler wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404);
  next(error);
}

// Global uncaught exception handler
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.systemError(error, 'uncaughtException');
    
    // Give time for logs to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.systemError(error, 'unhandledRejection');
    
    // Don't exit immediately on unhandled rejections, just log them
    // The application should handle these gracefully
  });

  // Graceful shutdown handlers
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    // Give pending operations time to complete
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 10000); // 10 seconds
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Request timeout handler
export function timeoutHandler(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError('Request timeout', 408);
        next(error);
      }
    }, timeout);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

// Rate limit error handler
export function rateLimitHandler(req: Request, res: Response): void {
  logger.security('Rate limit exceeded', {
    ip: req.ip,
    url: req.originalUrl,
    userAgent: req.get('User-Agent')
  });

  res.status(429).json({
    success: false,
    error: {
      name: 'RateLimitError',
      message: 'Too many requests, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
      retryAfter: 60 // seconds
    }
  });
}

// Validation error handler for Joi
export function validationErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  if (error.isJoi) {
    const validationErrors = error.details.map((detail: any) => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    res.status(400).json({
      success: false,
      error: {
        name: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        validationErrors
      }
    });
    return;
  }

  next(error);
}

// Database error handler
export function databaseErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  // SQLite specific error handling
  if (error.code && error.code.startsWith('SQLITE_')) {
    let message = 'Database operation failed';
    let statusCode = 500;

    switch (error.code) {
      case 'SQLITE_CONSTRAINT_UNIQUE':
        message = 'A record with this information already exists';
        statusCode = 409;
        break;
      case 'SQLITE_CONSTRAINT_FOREIGNKEY':
        message = 'Referenced record does not exist';
        statusCode = 400;
        break;
      case 'SQLITE_CONSTRAINT_NOTNULL':
        message = 'Required information is missing';
        statusCode = 400;
        break;
      case 'SQLITE_BUSY':
        message = 'Database is currently busy, please try again';
        statusCode = 503;
        break;
      case 'SQLITE_LOCKED':
        message = 'Database operation is locked';
        statusCode = 503;
        break;
    }

    logger.database('Database constraint violation', undefined, undefined, error);

    res.status(statusCode).json({
      success: false,
      error: {
        name: 'DatabaseError',
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next(error);
}

// Security error handler
export function securityErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  // Handle various security-related errors
  if (error.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
    }

    logger.security('File upload security error', {
      code: error.code,
      field: error.field,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(statusCode).json({
      success: false,
      error: {
        name: 'FileUploadError',
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next(error);
}

// Error handling pipeline
export function setupErrorHandling(app: any): void {
  // Security error handler
  app.use(securityErrorHandler);
  
  // Database error handler
  app.use(databaseErrorHandler);
  
  // Validation error handler
  app.use(validationErrorHandler);
  
  // 404 handler for unmatched routes
  app.use(notFoundHandler);
  
  // Main error handler (must be last)
  app.use(errorHandler);
  
  // Setup global error handlers
  setupGlobalErrorHandlers();
}