/**
 * Encryption service tests
 */

import { EncryptionService } from '../../services/encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    const config = {
      algorithm: 'aes-256-gcm',
      keyDerivation: {
        iterations: 100000,
        keyLength: 32,
        digest: 'sha512'
      }
    };
    encryptionService = new EncryptionService(config, 'test-master-password');
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt string data successfully', async () => {
      const testData = 'This is a test string';
      
      const encrypted = await encryptionService.encrypt(testData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted.toString('utf8')).toBe(testData);
    });

    it('should encrypt and decrypt buffer data successfully', async () => {
      const testData = Buffer.from('This is a test buffer');
      
      const encrypted = await encryptionService.encrypt(testData);
      const decrypted = await encryptionService.decrypt(encrypted);
      
      expect(decrypted.equals(testData)).toBe(true);
    });

    it('should produce different encrypted results for same input', async () => {
      const testData = 'Same input';
      
      const encrypted1 = await encryptionService.encrypt(testData);
      const encrypted2 = await encryptionService.encrypt(testData);
      
      // Different salt and IV should produce different encrypted data
      expect(encrypted1.encrypted.equals(encrypted2.encrypted)).toBe(false);
      expect(encrypted1.salt.equals(encrypted2.salt)).toBe(false);
      expect(encrypted1.iv.equals(encrypted2.iv)).toBe(false);

      // But both should decrypt to the same original data
      const decrypted1 = await encryptionService.decrypt(encrypted1);
      const decrypted2 = await encryptionService.decrypt(encrypted2);
      
      expect(decrypted1.toString('utf8')).toBe(testData);
      expect(decrypted2.toString('utf8')).toBe(testData);
    });

    it('should fail to decrypt with wrong auth tag', async () => {
      const testData = 'Test data';
      const encrypted = await encryptionService.encrypt(testData);
      
      // Corrupt the auth tag
      encrypted.authTag = Buffer.alloc(16, 0);
      
      await expect(encryptionService.decrypt(encrypted))
        .rejects.toThrow('Failed to decrypt data');
    });
  });

  describe('encryptJSON and decryptJSON', () => {
    it('should encrypt and decrypt JSON objects', async () => {
      const testObject = {
        name: 'John Doe',
        age: 30,
        active: true,
        metadata: {
          created: '2024-01-01',
          tags: ['test', 'user']
        }
      };

      const encrypted = await encryptionService.encryptJSON(testObject);
      const decrypted = await encryptionService.decryptJSON(encrypted);
      
      expect(decrypted).toEqual(testObject);
    });

    it('should handle complex nested objects', async () => {
      const complexObject = {
        patient: {
          name: 'Jane Smith',
          vitals: [
            { time: '10:00', bp: '120/80' },
            { time: '10:30', bp: '125/85' }
          ]
        },
        medications: null,
        notes: 'Test notes with special chars: !@#$%^&*()'
      };

      const encrypted = await encryptionService.encryptJSON(complexObject);
      const decrypted = await encryptionService.decryptJSON(encrypted);
      
      expect(decrypted).toEqual(complexObject);
    });
  });

  describe('encryptToBase64 and decryptFromBase64', () => {
    it('should encrypt to base64 and decrypt successfully', async () => {
      const testData = 'Base64 encryption test';
      
      const base64Encrypted = await encryptionService.encryptToBase64(testData);
      expect(typeof base64Encrypted).toBe('string');
      
      const decrypted = await encryptionService.decryptFromBase64(base64Encrypted);
      expect(decrypted.toString('utf8')).toBe(testData);
    });
  });

  describe('encryptDraftData and decryptDraftData', () => {
    it('should encrypt and decrypt draft data for database storage', async () => {
      const draftData = {
        patientName: 'Test Patient',
        incidentDate: '2024-01-01',
        vitalSigns: [{ time: '10:00', hr: 75 }]
      };

      const encrypted = await encryptionService.encryptDraftData(draftData);
      expect(encrypted.data_encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.auth_tag).toBeDefined();

      const decrypted = await encryptionService.decryptDraftData(encrypted);
      expect(decrypted).toEqual(draftData);
    });
  });

  describe('createHash and verifyHash', () => {
    it('should create and verify hashes correctly', () => {
      const testData = 'Data to hash';
      
      const hash1 = encryptionService.createHash(testData);
      const hash2 = encryptionService.createHash(testData);
      
      // Same data should produce same hash
      expect(hash1).toBe(hash2);
      
      // Hash verification should work
      expect(encryptionService.verifyHash(testData, hash1)).toBe(true);
      expect(encryptionService.verifyHash('different data', hash1)).toBe(false);
    });

    it('should work with different hash algorithms', () => {
      const testData = 'Test data';
      
      const sha256Hash = encryptionService.createHash(testData, 'sha256');
      const sha512Hash = encryptionService.createHash(testData, 'sha512');
      
      expect(sha256Hash).not.toBe(sha512Hash);
      expect(encryptionService.verifyHash(testData, sha256Hash, 'sha256')).toBe(true);
      expect(encryptionService.verifyHash(testData, sha512Hash, 'sha512')).toBe(true);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate secure passwords of specified length', () => {
      const password8 = encryptionService.generateSecurePassword(8);
      const password16 = encryptionService.generateSecurePassword(16);
      const password32 = encryptionService.generateSecurePassword(32);
      
      expect(password8).toHaveLength(8);
      expect(password16).toHaveLength(16);
      expect(password32).toHaveLength(32);
      
      // Should be different each time
      expect(password8).not.toBe(encryptionService.generateSecurePassword(8));
    });

    it('should contain mixed character types', () => {
      const password = encryptionService.generateSecurePassword(20);
      
      // Should contain at least one of each type (this is probabilistic)
      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[A-Z]/); // uppercase  
      expect(password).toMatch(/[0-9]/); // numbers
      expect(password).toMatch(/[!@#$%^&*(),.?":{}|<>]/); // special chars
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      const strongPassword = 'StrongP@ssw0rd123!';
      const result = encryptionService.validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPassword = 'weak';
      const result = encryptionService.validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(4);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should provide specific feedback for password issues', () => {
      const tests = [
        { password: 'short', expectedFeedback: 'at least 8 characters' },
        { password: 'nouppercase123!', expectedFeedback: 'uppercase letter' },
        { password: 'NOLOWERCASE123!', expectedFeedback: 'lowercase letter' },
        { password: 'NoNumbers!', expectedFeedback: 'number' },
        { password: 'NoSpecialChars123', expectedFeedback: 'special character' }
      ];

      tests.forEach(({ password, expectedFeedback }) => {
        const result = encryptionService.validatePasswordStrength(password);
        expect(result.feedback.some(f => f.includes(expectedFeedback))).toBe(true);
      });
    });
  });

  describe('testEncryption', () => {
    it('should pass encryption round-trip test', async () => {
      const result = await encryptionService.testEncryption();
      expect(result).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return encryption statistics', () => {
      const stats = encryptionService.getStats();
      
      expect(stats.algorithm).toBe('aes-256-gcm');
      expect(stats.keyDerivation).toBeDefined();
      expect(stats.masterKeyLength).toBe(32);
    });
  });
});