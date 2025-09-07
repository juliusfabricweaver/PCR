/**
 * Test setup and configuration
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-characters-minimum';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-different-from-jwt-key';
process.env.ENCRYPTION_MASTER_PASSWORD = 'test-encryption-password';
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpassword123!';
process.env.DB_FILENAME = ':memory:'; // Use in-memory database for tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  createTestUser: () => ({
    username: 'testuser',
    password: 'testpass123!',
    role: 'user'
  }),
  
  createTestAdmin: () => ({
    username: 'testadmin',
    password: 'adminpass123!',
    role: 'admin'
  }),
  
  createTestDraftData: () => ({
    patientName: 'John Doe',
    patientId: 'P12345',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    incidentDate: '2024-01-01',
    incidentTime: '10:30',
    incidentLocation: 'Test Location',
    chiefComplaint: 'Test complaint',
    historyOfPresentIllness: 'Test history',
    vitalSigns: [{
      timestamp: new Date().toISOString(),
      heartRate: 80,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80
    }],
    treatmentProvided: 'Test treatment',
    transportMethod: 'ambulance',
    destinationFacility: 'Test Hospital',
    primaryProvider: 'Test Provider'
  })
};

export default {};