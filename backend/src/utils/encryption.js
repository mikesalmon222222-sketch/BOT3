import crypto from 'crypto';
import logger from './logger.js';

const algorithm = 'aes-256-gcm';
const keyLength = 32; // 256 bits

// Get or generate encryption key from environment
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (key) {
    return Buffer.from(key, 'hex');
  }
  
  // Generate a new key if not provided (for development)
  const newKey = crypto.randomBytes(keyLength);
  logger.warn('No ENCRYPTION_KEY provided, using generated key. This should only happen in development.');
  logger.warn(`Generated key: ${newKey.toString('hex')}`);
  return newKey;
};

const encryptionKey = getEncryptionKey();

/**
 * Encrypt a text string
 * @param {string} text - The text to encrypt
 * @returns {string} - Encrypted text with IV and auth tag
 */
export const encrypt = (text) => {
  try {
    if (!text) return '';
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(algorithm, encryptionKey, iv);
    cipher.setAAD(Buffer.from('septa-credentials'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - The encrypted data string
 * @returns {string} - Decrypted text
 */
export const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) return '';
    
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipherGCM(algorithm, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from('septa-credentials'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate a secure hash for deduplication
 * @param {string} text - Text to hash
 * @returns {string} - SHA-256 hash
 */
export const generateHash = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};