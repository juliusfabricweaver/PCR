/**
 * Request validation middleware using Joi
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError, createValidationError } from '../utils/errors';

// Validation middleware factory
export function validate(schema: {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `body.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `query.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `params.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate headers
    if (schema.headers) {
      const { error } = schema.headers.validate(req.headers);
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `headers.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    if (errors.length > 0) {
      return next(createValidationError(errors));
    }

    next();
  };
}

// Common validation schemas
export const commonSchemas = {
  id: Joi.number().integer().positive().required(),
  username: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('admin', 'user').required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
  }
};

// Auth validation schemas
export const authSchemas = {
  login: {
    body: Joi.object({
      username: commonSchemas.username,
      password: Joi.string().required()
    })
  },

  refreshToken: {
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: commonSchemas.password
    })
  }
};

// User validation schemas
export const userSchemas = {
  create: {
    body: Joi.object({
      username: commonSchemas.username,
      password: commonSchemas.password,
      role: commonSchemas.role
    })
  },

  update: {
    params: Joi.object({
      id: commonSchemas.id
    }),
    body: Joi.object({
      username: commonSchemas.username.optional(),
      role: commonSchemas.role.optional()
    }).min(1)
  },

  delete: {
    params: Joi.object({
      id: commonSchemas.id
    })
  },

  getById: {
    params: Joi.object({
      id: commonSchemas.id
    })
  },

  list: {
    query: Joi.object(commonSchemas.pagination)
  }
};

// Draft validation schemas
export const draftSchemas = {
  save: {
    body: Joi.object({
      data: Joi.object().required()
    })
  },

  get: {
    params: Joi.object({
      id: commonSchemas.id
    })
  },

  update: {
    params: Joi.object({
      id: commonSchemas.id
    }),
    body: Joi.object({
      data: Joi.object().required()
    })
  },

  delete: {
    params: Joi.object({
      id: commonSchemas.id
    })
  },

  list: {
    query: Joi.object({
      ...commonSchemas.pagination,
      userId: Joi.number().integer().positive().optional()
    })
  }
};

// Submission validation schemas
export const submissionSchemas = {
  create: {
    body: Joi.object({
      data: Joi.object().required()
    })
  },

  get: {
    params: Joi.object({
      id: commonSchemas.id
    })
  },

  list: {
    query: Joi.object({
      ...commonSchemas.pagination,
      userId: Joi.number().integer().positive().optional(),
      dateFrom: Joi.date().iso().optional(),
      dateTo: Joi.date().iso().optional()
    })
  }
};

// Log validation schemas
export const logSchemas = {
  list: {
    query: Joi.object({
      ...commonSchemas.pagination,
      userId: Joi.number().integer().positive().optional(),
      action: Joi.string().valid(
        'login', 'logout', 'draft_saved', 'draft_loaded', 'form_submitted',
        'form_cleared', 'user_created', 'user_deleted', 'failed_login',
        'account_locked', 'session_expired'
      ).optional(),
      dateFrom: Joi.date().iso().optional(),
      dateTo: Joi.date().iso().optional()
    })
  }
};

// PCR Form specific validation (customize based on your form fields)
export const pcrFormSchema = Joi.object({
  // Patient Information
  patientName: Joi.string().max(100).required(),
  patientId: Joi.string().max(50).required(),
  dateOfBirth: Joi.date().iso().required(),
  gender: Joi.string().valid('M', 'F', 'Other').required(),
  
  // Incident Information
  incidentDate: Joi.date().iso().required(),
  incidentTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  incidentLocation: Joi.string().max(200).required(),
  
  // PCR Details
  chiefComplaint: Joi.string().max(500).required(),
  historyOfPresentIllness: Joi.string().max(1000).required(),
  pastMedicalHistory: Joi.string().max(500).optional(),
  medications: Joi.string().max(500).optional(),
  allergies: Joi.string().max(200).optional(),
  
  // Vital Signs
  vitalSigns: Joi.array().items(
    Joi.object({
      timestamp: Joi.date().iso().required(),
      bloodPressureSystolic: Joi.number().integer().min(50).max(300).optional(),
      bloodPressureDiastolic: Joi.number().integer().min(30).max(200).optional(),
      heartRate: Joi.number().integer().min(30).max(200).optional(),
      respiratoryRate: Joi.number().integer().min(6).max(60).optional(),
      temperature: Joi.number().min(90).max(110).optional(),
      oxygenSaturation: Joi.number().integer().min(50).max(100).optional(),
      glucoseLevel: Joi.number().min(20).max(800).optional()
    })
  ).min(1).required(),
  
  // Treatment
  treatmentProvided: Joi.string().max(1000).required(),
  medicationsAdministered: Joi.array().items(
    Joi.object({
      medication: Joi.string().max(100).required(),
      dose: Joi.string().max(50).required(),
      route: Joi.string().max(30).required(),
      time: Joi.date().iso().required()
    })
  ).optional(),
  
  // Transport
  transportMethod: Joi.string().valid('ambulance', 'helicopter', 'other', 'refused').required(),
  destinationFacility: Joi.string().max(200).when('transportMethod', {
    not: 'refused',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  
  // Crew Information
  primaryProvider: Joi.string().max(100).required(),
  secondaryProvider: Joi.string().max(100).optional(),
  supervisingPhysician: Joi.string().max(100).optional(),
  
  // Additional Information
  additionalNotes: Joi.string().max(2000).optional(),
  
  // Metadata
  createdAt: Joi.date().iso().optional(),
  lastModified: Joi.date().iso().optional()
});

// Custom validation functions
export function validatePcrForm(req: Request, res: Response, next: NextFunction) {
  const { error, value } = pcrFormSchema.validate(req.body.data || req.body);
  
  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return next(createValidationError(validationErrors, 'PCR form validation failed'));
  }
  
  // Add validated data back to request
  if (req.body.data) {
    req.body.data = value;
  } else {
    req.body = value;
  }
  
  next();
}

// Password strength validation
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeating characters');
  }
  
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    'admin', 'root', 'user', 'test', 'guest'
  ];
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password should not contain common words');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Sanitize input data
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Recursive function to sanitize object
    function sanitize(obj: any): any {
      if (typeof obj === 'string') {
        // Basic XSS protection - remove script tags and javascript: protocols
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .trim();
      } else if (Array.isArray(obj)) {
        return obj.map(sanitize);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      }
      return obj;
    }
    
    // Sanitize request body
    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitize(req.query);
    }
    
    next();
  };
}