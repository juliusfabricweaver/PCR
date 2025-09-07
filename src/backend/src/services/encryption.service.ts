/**
 * Encryption service with AES-256-GCM and PBKDF2 key derivation
 * Provides secure encryption/decryption for draft data
 */

import { createCipher, createDecipher, randomBytes, pbkdf2, createHash, scryptSync } from 'crypto';
import { promisify } from 'util';
import { EncryptionResult, DecryptionInput } from '../types';
import { logger } from './logger';

const pbkdf2Async = promisify(pbkdf2);

export interface EncryptionConfig {
  algorithm: string;
  keyDerivation: {
    iterations: number;
    keyLength: number;
    digest: string;
  };
}

export class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;

  constructor(config: EncryptionConfig, masterPassword: string) {
    this.config = config;
    
    // Derive master key from password using scrypt (more secure than PBKDF2 for key derivation)
    this.masterKey = scryptSync(masterPassword, 'pcr-app-salt', 32);
  }

  /**
   * Generate a random salt
   */
  private generateSalt(length: number = 32): Buffer {
    return randomBytes(length);
  }

  /**
   * Generate a random IV
   */
  private generateIV(length: number = 12): Buffer {
    return randomBytes(length);
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private async deriveKey(salt: Buffer): Promise<Buffer> {
    try {
      return await pbkdf2Async(
        this.masterKey,
        salt,
        this.config.keyDerivation.iterations,
        this.config.keyDerivation.keyLength,
        this.config.keyDerivation.digest
      );
    } catch (error) {
      logger.error('Key derivation failed:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(data: string | Buffer): Promise<EncryptionResult> {
    try {
      const inputData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      
      // Generate random salt and IV
      const salt = this.generateSalt();
      const iv = this.generateIV();
      
      // Derive encryption key
      const key = await this.deriveKey(salt);
      
      // Create cipher
      const cipher = createCipher('aes-256-gcm', key);
      cipher.setAutoPadding(true);
      
      // Set IV
      const actualCipher = cipher as any;
      if (actualCipher.setAAD) {
        actualCipher.setAAD(Buffer.alloc(0)); // Empty additional authenticated data
      }

      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(inputData),
        cipher.final()
      ]);

      // Get authentication tag
      const authTag = (cipher as any).getAuthTag() as Buffer;

      const result: EncryptionResult = {
        encrypted,
        iv,
        salt,
        authTag
      };

      logger.debug('Data encrypted successfully', {
        originalSize: inputData.length,
        encryptedSize: encrypted.length,
        saltLength: salt.length,
        ivLength: iv.length,
        authTagLength: authTag.length
      });

      return result;

    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(input: DecryptionInput): Promise<Buffer> {
    try {
      const { encrypted, iv, salt, authTag } = input;
      
      // Derive decryption key
      const key = await this.deriveKey(salt);
      
      // Create decipher
      const decipher = createDecipher('aes-256-gcm', key);
      decipher.setAutoPadding(true);
      
      // Set auth tag
      const actualDecipher = decipher as any;
      if (actualDecipher.setAuthTag) {
        actualDecipher.setAuthTag(authTag);
      }
      
      if (actualDecipher.setAAD) {
        actualDecipher.setAAD(Buffer.alloc(0)); // Empty additional authenticated data
      }

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      logger.debug('Data decrypted successfully', {
        encryptedSize: encrypted.length,
        decryptedSize: decrypted.length
      });

      return decrypted;

    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - data may be corrupted or tampered with');
    }
  }

  /**
   * Encrypt JSON data
   */
  async encryptJSON(data: any): Promise<EncryptionResult> {
    try {
      const jsonString = JSON.stringify(data);
      return await this.encrypt(jsonString);
    } catch (error) {
      logger.error('JSON encryption failed:', error);
      throw new Error('Failed to encrypt JSON data');
    }
  }

  /**
   * Decrypt to JSON data
   */
  async decryptJSON<T = any>(input: DecryptionInput): Promise<T> {
    try {
      const decrypted = await this.decrypt(input);
      const jsonString = decrypted.toString('utf8');
      return JSON.parse(jsonString) as T;
    } catch (error) {
      logger.error('JSON decryption failed:', error);
      throw new Error('Failed to decrypt JSON data');
    }
  }

  /**
   * Create a hash of data for integrity verification
   */
  createHash(data: string | Buffer, algorithm: string = 'sha256'): string {
    try {
      const hash = createHash(algorithm);
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      logger.error('Hash creation failed:', error);
      throw new Error('Failed to create data hash');
    }
  }

  /**
   * Verify data integrity using hash
   */
  verifyHash(data: string | Buffer, expectedHash: string, algorithm: string = 'sha256'): boolean {
    try {
      const actualHash = this.createHash(data, algorithm);
      return actualHash === expectedHash;
    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Encrypt and encode as base64 string (for storage)
   */
  async encryptToBase64(data: string | Buffer): Promise<string> {
    try {
      const encrypted = await this.encrypt(data);
      
      // Combine all components into a single buffer
      const combined = Buffer.concat([
        Buffer.from([encrypted.salt.length]), // 1 byte for salt length
        encrypted.salt,
        Buffer.from([encrypted.iv.length]), // 1 byte for IV length
        encrypted.iv,
        Buffer.from([encrypted.authTag.length]), // 1 byte for auth tag length
        encrypted.authTag,
        encrypted.encrypted
      ]);

      return combined.toString('base64');
    } catch (error) {
      logger.error('Base64 encryption failed:', error);
      throw new Error('Failed to encrypt and encode data');
    }
  }

  /**
   * Decrypt from base64 string
   */
  async decryptFromBase64(base64Data: string): Promise<Buffer> {
    try {
      const combined = Buffer.from(base64Data, 'base64');
      let offset = 0;

      // Extract salt
      const saltLength = combined[offset];
      offset += 1;
      const salt = combined.subarray(offset, offset + saltLength);
      offset += saltLength;

      // Extract IV
      const ivLength = combined[offset];
      offset += 1;
      const iv = combined.subarray(offset, offset + ivLength);
      offset += ivLength;

      // Extract auth tag
      const authTagLength = combined[offset];
      offset += 1;
      const authTag = combined.subarray(offset, offset + authTagLength);
      offset += authTagLength;

      // Extract encrypted data
      const encrypted = combined.subarray(offset);

      const input: DecryptionInput = {
        encrypted,
        iv,
        salt,
        authTag
      };

      return await this.decrypt(input);
    } catch (error) {
      logger.error('Base64 decryption failed:', error);
      throw new Error('Failed to decode and decrypt data');
    }
  }

  /**
   * Encrypt draft data for database storage
   */
  async encryptDraftData(draftData: any): Promise<{
    data_encrypted: Buffer;
    iv: Buffer;
    salt: Buffer;
    auth_tag: Buffer;
  }> {
    try {
      const encrypted = await this.encryptJSON(draftData);
      
      return {
        data_encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        salt: encrypted.salt,
        auth_tag: encrypted.authTag
      };
    } catch (error) {
      logger.error('Draft encryption failed:', error);
      throw new Error('Failed to encrypt draft data');
    }
  }

  /**
   * Decrypt draft data from database
   */
  async decryptDraftData<T = any>(encryptedData: {
    data_encrypted: Buffer;
    iv: Buffer;
    salt: Buffer;
    auth_tag: Buffer;
  }): Promise<T> {
    try {
      const input: DecryptionInput = {
        encrypted: encryptedData.data_encrypted,
        iv: encryptedData.iv,
        salt: encryptedData.salt,
        authTag: encryptedData.auth_tag
      };

      return await this.decryptJSON<T>(input);
    } catch (error) {
      logger.error('Draft decryption failed:', error);
      throw new Error('Failed to decrypt draft data');
    }
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const bytes = randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('Password must be at least 8 characters long');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain at least one uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain at least one lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain at least one number');
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain at least one special character');
    }

    // Length bonus
    if (password.length >= 12) {
      score += 1;
    }

    // No common patterns
    if (!/(.)\1{2,}/.test(password) && !/123|abc|qwe/i.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should not contain repeating characters or common sequences');
    }

    const isValid = score >= 4; // Minimum score for acceptance

    return {
      isValid,
      score,
      feedback
    };
  }

  /**
   * Securely wipe sensitive data from memory (best effort)
   */
  secureWipe(buffer: Buffer): void {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }

  /**
   * Get encryption statistics
   */
  getStats(): {
    algorithm: string;
    keyDerivation: any;
    masterKeyLength: number;
  } {
    return {
      algorithm: this.config.algorithm,
      keyDerivation: this.config.keyDerivation,
      masterKeyLength: this.masterKey.length
    };
  }

  /**
   * Test encryption/decryption round trip
   */
  async testEncryption(): Promise<boolean> {
    try {
      const testData = 'This is a test string for encryption verification';
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);
      
      const result = decrypted.toString('utf8') === testData;
      
      if (result) {
        logger.info('Encryption test passed');
      } else {
        logger.error('Encryption test failed');
      }
      
      return result;
    } catch (error) {
      logger.error('Encryption test failed with error:', error);
      return false;
    }
  }
}