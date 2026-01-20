import { ValidationError } from '../types'
import { VALIDATION_RULES as RULES } from '../constants'

// Date utilities
export const formatDate = (date: string | Date, format: 'short' | 'long' | 'datetime' = 'short'): string => {
  const d = new Date(date)
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date'
  }

  switch (format) {
    case 'short':
      return d.toLocaleDateString()
    case 'long':
      return d.toLocaleDateString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    case 'datetime':
      return d.toLocaleString()
    default:
      return d.toLocaleDateString()
  }
}

export const formatTime = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleTimeString('en-CA', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getCurrentDateTime = (): string => {
  return new Date().toISOString()
}

export const isValidDate = (date: string): boolean => {
  return !isNaN(new Date(date).getTime())
}

// String utilities
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const formatName = (firstName: string, lastName: string): string => {
  return `${capitalize(firstName)} ${capitalize(lastName)}`
}

export const formatSSN = (ssn: string): string => {
  const cleaned = ssn.replace(/\D/g, '')
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`
  }
  return ssn
}

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export const maskSSN = (ssn: string): string => {
  const formatted = formatSSN(ssn)
  if (formatted.length === 11) { // XXX-XX-XXXX format
    return `***-**-${formatted.slice(7)}`
  }
  return ssn
}

// Validation utilities
export const validateEmail = (email: string): boolean => {
  return RULES.EMAIL.PATTERN.test(email)
}

export const validatePhone = (phone: string): boolean => {
  return RULES.PHONE.PATTERN.test(phone)
}

export const validateSSN = (ssn: string): boolean => {
  return RULES.SSN.PATTERN.test(ssn)
}

export const validateZipCode = (zipCode: string): boolean => {
  return RULES.ZIP_CODE.PATTERN.test(zipCode)
}

export const validatePassword = (password: string): ValidationError[] => {
  const errors: ValidationError[] = []
  const rules = RULES.PASSWORD

  if (password.length < rules.MIN_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${rules.MIN_LENGTH} characters long`,
    })
  }

  if (rules.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one uppercase letter',
    })
  }

  if (rules.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one lowercase letter',
    })
  }

  if (rules.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one number',
    })
  }

  if (rules.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one special character',
    })
  }

  return errors
}

// Medical utilities
export const calculateAge = (dateOfBirth: string): number => {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}

export const formatVitalSigns = (systolic: number, diastolic: number): string => {
  return `${systolic}/${diastolic}`
}

export const getPainDescription = (scale: number): string => {
  const descriptions = [
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
  ]
  
  return descriptions[Math.max(0, Math.min(10, Math.floor(scale)))]
}

// Array utilities
export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const group = String(item[key])
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {} as Record<string, T[]>)
}

export const sortBy = <T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aValue = a[key]
    const bValue = b[key]
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1
    if (aValue > bValue) return direction === 'asc' ? 1 : -1
    return 0
  })
}

// Object utilities
export const omit = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

// Storage utilities (for localStorage/sessionStorage)
// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const storage = {
  get: (key: string): any => {
    if (!isBrowser) return null;
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  },
  set: (key: string, value: any): void => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  },
  remove: (key: string): void => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to remove from localStorage:', error)
    }
  },
}

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Generate unique IDs
export const generateId = (): string => {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15)
}

// Error handling
export const handleError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}