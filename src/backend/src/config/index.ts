/**
 * Configuration management with environment variables and validation
 */

import path from 'path';
import { existsSync, readFileSync } from 'fs';
import Joi from 'joi';
import { AppConfig } from '../types';
import { logger } from '../services/logger';
import { ConfigurationError } from '../utils/errors';

// Environment variable schema validation
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  
  // Server configuration
  PORT: Joi.number().default(3001),
  HOST: Joi.string().default('localhost'),
  
  // Database configuration
  DB_FILENAME: Joi.string().default('pcr-app.sqlite'),
  DB_MAX_CONNECTIONS: Joi.number().default(10),
  DB_BUSY_TIMEOUT: Joi.number().default(30000),
  DB_ENABLE_FOREIGN_KEYS: Joi.boolean().default(true),
  
  // JWT configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  
  // Encryption configuration
  ENCRYPTION_ALGORITHM: Joi.string().default('aes-256-gcm'),
  ENCRYPTION_MASTER_PASSWORD: Joi.string().min(16).required(),
  PBKDF2_ITERATIONS: Joi.number().default(100000),
  PBKDF2_KEY_LENGTH: Joi.number().default(32),
  PBKDF2_DIGEST: Joi.string().default('sha512'),
  
  // Security configuration
  BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
  MAX_LOGIN_ATTEMPTS: Joi.number().default(5),
  LOCKOUT_DURATION: Joi.number().default(1800), // 30 minutes
  RATE_LIMIT_WINDOW: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().default(100),
  
  // Session configuration
  SESSION_TIMEOUT: Joi.number().default(900), // 15 minutes
  SESSION_WARNING_TIME: Joi.number().default(840), // 14 minutes
  
  // Logging configuration
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose', 'silly')
    .default('info'),
  LOG_MAX_FILES: Joi.number().default(14),
  LOG_MAX_SIZE: Joi.string().default('10m'),
  LOG_DATE_PATTERN: Joi.string().default('YYYY-MM-DD'),
  
  // Admin account configuration (for initial setup)
  ADMIN_USERNAME: Joi.string().min(3).default('admin'),
  ADMIN_PASSWORD: Joi.string().min(8).required()
}).unknown();

// Load environment variables from .env file if it exists
function loadEnvFile(): void {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'src', 'backend', '.env')
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, '');
              process.env[key.trim()] = value;
            }
          }
        }
        
        logger.configLoaded(`Environment file: ${envPath}`);
        break;
      } catch (error) {
        logger.configError(error as Error, envPath);
      }
    }
  }
}

// Validate and parse environment variables
function validateEnvironment(): any {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true
  });

  if (error) {
    const errorMessage = `Environment validation failed: ${error.details.map(x => x.message).join(', ')}`;
    throw new ConfigurationError(errorMessage, 'environment');
  }

  return value;
}

// Generate secure secrets if not provided (development only)
function generateSecrets(env: any): void {
  const crypto = require('crypto');
  
  if (env.NODE_ENV === 'development') {
    if (!env.JWT_SECRET) {
      env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
      logger.warn('Generated JWT secret for development. Use a fixed secret for production!');
    }
    
    if (!env.REFRESH_TOKEN_SECRET) {
      env.REFRESH_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
      logger.warn('Generated refresh token secret for development. Use a fixed secret for production!');
    }
    
    if (!env.ENCRYPTION_MASTER_PASSWORD) {
      env.ENCRYPTION_MASTER_PASSWORD = crypto.randomBytes(16).toString('hex');
      logger.warn('Generated encryption master password for development. Use a fixed password for production!');
    }
    
    if (!env.ADMIN_PASSWORD) {
      env.ADMIN_PASSWORD = 'admin123!'; // Simple default for development
      logger.warn('Using default admin password for development. Change this for production!');
    }
  }
}

// Create application configuration
function createAppConfig(env: any): AppConfig {
  return {
    port: env.PORT,
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
    
    database: {
      filename: path.resolve(env.DB_FILENAME),
      maxConnections: env.DB_MAX_CONNECTIONS,
      busyTimeout: env.DB_BUSY_TIMEOUT,
      enableForeignKeys: env.DB_ENABLE_FOREIGN_KEYS
    },
    
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshSecret: env.REFRESH_TOKEN_SECRET,
      refreshExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN
    },
    
    encryption: {
      algorithm: env.ENCRYPTION_ALGORITHM,
      keyDerivation: {
        iterations: env.PBKDF2_ITERATIONS,
        keyLength: env.PBKDF2_KEY_LENGTH,
        digest: env.PBKDF2_DIGEST
      }
    },
    
    security: {
      bcryptRounds: env.BCRYPT_ROUNDS,
      maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
      lockoutDuration: env.LOCKOUT_DURATION,
      rateLimitWindow: env.RATE_LIMIT_WINDOW,
      rateLimitMax: env.RATE_LIMIT_MAX
    },
    
    session: {
      timeout: env.SESSION_TIMEOUT,
      warningTime: env.SESSION_WARNING_TIME
    },
    
    logs: {
      level: env.LOG_LEVEL,
      maxFiles: env.LOG_MAX_FILES,
      maxSize: env.LOG_MAX_SIZE,
      datePattern: env.LOG_DATE_PATTERN
    }
  };
}

// Configuration validation
function validateConfig(config: AppConfig): void {
  // Validate security settings
  if (config.security.bcryptRounds < 10) {
    throw new ConfigurationError('BCrypt rounds must be at least 10 for security', 'security.bcryptRounds');
  }

  if (config.jwt.secret.length < 32) {
    throw new ConfigurationError('JWT secret must be at least 32 characters long', 'jwt.secret');
  }

  if (config.jwt.refreshSecret.length < 32) {
    throw new ConfigurationError('Refresh token secret must be at least 32 characters long', 'jwt.refreshSecret');
  }

  // Production-specific validations
  if (config.nodeEnv === 'production') {
    if (config.jwt.secret === config.jwt.refreshSecret) {
      throw new ConfigurationError('JWT secret and refresh secret must be different in production', 'jwt.secrets');
    }

    if (config.logs.level === 'debug' || config.logs.level === 'silly') {
      logger.warn('Debug logging enabled in production - this may impact performance');
    }
  }

  // Database path validation
  const dbDir = path.dirname(config.database.filename);
  if (!existsSync(dbDir)) {
    logger.warn(`Database directory does not exist: ${dbDir}. It will be created.`);
  }
}

// Load and create configuration
export function loadConfiguration(): { 
  config: AppConfig; 
  adminUsername: string; 
  adminPassword: string;
  encryptionPassword: string;
} {
  try {
    // Load environment file
    loadEnvFile();

    // Validate environment variables
    const env = validateEnvironment();

    // Generate secrets if needed (development only)
    generateSecrets(env);

    // Create configuration object
    const config = createAppConfig(env);

    // Validate configuration
    validateConfig(config);

    // Log successful configuration loading
    logger.configLoaded('Application configuration', [
      'port', 'host', 'nodeEnv', 'database', 'security', 'session', 'logs'
    ]);

    // Return configuration and sensitive data separately
    return {
      config,
      adminUsername: env.ADMIN_USERNAME,
      adminPassword: env.ADMIN_PASSWORD,
      encryptionPassword: env.ENCRYPTION_MASTER_PASSWORD
    };

  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    } else {
      throw new ConfigurationError(`Failed to load configuration: ${(error as Error).message}`, undefined, { originalError: error });
    }
  }
}

// Get environment-specific settings
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      corsOrigin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      trustProxy: false,
      compression: false,
      helmet: {
        contentSecurityPolicy: false
      }
    },
    test: {
      corsOrigin: ['http://localhost:3000'],
      trustProxy: false,
      compression: false,
      helmet: {
        contentSecurityPolicy: false
      }
    },
    production: {
      corsOrigin: false, // Disable CORS in production (NW.js app)
      trustProxy: true,
      compression: true,
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        }
      }
    }
  };

  return configs[env as keyof typeof configs] || configs.development;
}

// Configuration summary for logging
export function getConfigSummary(config: AppConfig): any {
  return {
    nodeEnv: config.nodeEnv,
    port: config.port,
    host: config.host,
    database: {
      filename: config.database.filename,
      maxConnections: config.database.maxConnections
    },
    security: {
      bcryptRounds: config.security.bcryptRounds,
      maxLoginAttempts: config.security.maxLoginAttempts,
      sessionTimeout: config.session.timeout
    },
    logs: {
      level: config.logs.level,
      maxFiles: config.logs.maxFiles
    }
  };
}

// Check if configuration is valid for production
export function isProductionReady(config: AppConfig): { ready: boolean; issues: string[] } {
  const issues: string[] = [];

  if (config.nodeEnv !== 'production') {
    issues.push('NODE_ENV is not set to production');
  }

  if (config.logs.level === 'debug' || config.logs.level === 'silly') {
    issues.push('Log level is set to debug/silly which may impact performance');
  }

  if (config.security.bcryptRounds < 12) {
    issues.push('BCrypt rounds should be at least 12 for production');
  }

  if (config.jwt.expiresIn === '24h' || config.jwt.expiresIn === '1d') {
    issues.push('JWT token expiry time is too long for production');
  }

  return {
    ready: issues.length === 0,
    issues
  };
}

// Export default configuration
export const appConfig = loadConfiguration();