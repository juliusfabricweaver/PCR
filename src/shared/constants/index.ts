// Application constants

export const APP_CONFIG = {
  NAME: 'PCR Application',
  VERSION: '1.0.0',
  DESCRIPTION: 'Patient Care Report Management System',
} as const

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    PROFILE: '/api/auth/profile',
  },
  PATIENTS: {
    BASE: '/api/patients',
    BY_ID: (id: string) => `/api/patients/${id}`,
    SEARCH: '/api/patients/search',
  },
  PCR: {
    BASE: '/api/pcr',
    BY_ID: (id: string) => `/api/pcr/${id}`,
    BY_PATIENT: (patientId: string) => `/api/pcr/patient/${patientId}`,
    EXPORT_PDF: (id: string) => `/api/pcr/${id}/pdf`,
  },
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
  },
} as const

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PATIENTS: '/patients',
  PATIENT_DETAIL: '/patients/:id',
  PCR: '/pcr',
  PCR_NEW: '/pcr/new',
  PCR_EDIT: '/pcr/:id/edit',
  PCR_VIEW: '/pcr/:id',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  PROFILE: '/profile',
} as const

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'pcr_auth_token',
  USER_PREFERENCES: 'pcr_user_preferences',
  DRAFT_PCR: 'pcr_draft_',
  THEME: 'pcr_theme',
} as const

export const VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
  },
  SSN: {
    PATTERN: /^\d{3}-?\d{2}-?\d{4}$/,
  },
  PHONE: {
    PATTERN: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  ZIP_CODE: {
    PATTERN: /^\d{5}(-\d{4})?$/,
  },
} as const

export const MEDICAL_CONSTANTS = {
  VITAL_SIGNS: {
    BLOOD_PRESSURE: {
      NORMAL_SYSTOLIC: { min: 90, max: 120 },
      NORMAL_DIASTOLIC: { min: 60, max: 80 },
    },
    HEART_RATE: {
      NORMAL_ADULT: { min: 60, max: 100 },
    },
    RESPIRATORY_RATE: {
      NORMAL_ADULT: { min: 12, max: 20 },
    },
    TEMPERATURE: {
      NORMAL_FAHRENHEIT: { min: 97.0, max: 99.5 },
      NORMAL_CELSIUS: { min: 36.1, max: 37.5 },
    },
    OXYGEN_SATURATION: {
      NORMAL: { min: 95, max: 100 },
    },
  },
  PAIN_SCALE: {
    MIN: 0,
    MAX: 10,
    DESCRIPTIONS: [
      'No pain',
      'Mild pain',
      'Mild pain',
      'Moderate pain',
      'Moderate pain',
      'Moderate pain',
      'Severe pain',
      'Severe pain',
      'Very severe pain',
      'Very severe pain',
      'Worst possible pain',
    ],
  },
} as const

export const ROLES = {
  EMT: 'emt',
  PARAMEDIC: 'paramedic',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
} as const

export const PERMISSIONS = {
  [ROLES.EMT]: ['read_pcr', 'create_pcr', 'update_own_pcr'],
  [ROLES.PARAMEDIC]: ['read_pcr', 'create_pcr', 'update_pcr', 'administer_medications'],
  [ROLES.SUPERVISOR]: ['read_pcr', 'create_pcr', 'update_pcr', 'delete_pcr', 'approve_pcr'],
  [ROLES.ADMIN]: ['all'],
} as const

export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  VALIDATION: 'Please check your input and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
} as const

export const SUCCESS_MESSAGES = {
  PCR_SAVED: 'PCR saved successfully',
  PCR_SUBMITTED: 'PCR submitted successfully',
  PATIENT_SAVED: 'Patient information saved successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
} as const