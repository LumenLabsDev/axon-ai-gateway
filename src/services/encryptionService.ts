import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption service for provider API keys
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment variable
 * Derives a key from the password using scrypt
 */
function getDerivedKey(salt: Buffer): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [EncryptionService] [ERROR] ENCRYPTION_KEY environment variable is not set`);
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  // Use scrypt to derive a key from the password
  return scryptSync(encryptionKey, salt, KEY_LENGTH);
}

/**
 * Encrypt a provider API key
 * @param plaintext - The API key to encrypt
 * @returns Encrypted key as base64 string (format: salt:iv:authTag:ciphertext)
 */
export function encryptProviderKey(plaintext: string): string {
  const timestamp = new Date().toISOString();
  
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive key from password
    const key = getDerivedKey(salt);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine salt, iv, authTag, and ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);
    
    console.log(`[${timestamp}] [EncryptionService] [INFO] Provider key encrypted successfully`);
    return combined.toString('base64');
  } catch (error: any) {
    console.error(`[${timestamp}] [EncryptionService] [ERROR] Encryption failed:`, error.message);
    throw new Error('Failed to encrypt provider key');
  }
}

/**
 * Decrypt a provider API key
 * @param encrypted - The encrypted key (base64 string)
 * @returns Decrypted API key
 */
export function decryptProviderKey(encrypted: string): string {
  const timestamp = new Date().toISOString();
  
  try {
    // Decode base64
    const combined = Buffer.from(encrypted, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive key
    const key = getDerivedKey(salt);
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error: any) {
    console.error(`[${timestamp}] [EncryptionService] [ERROR] Decryption failed:`, error.message);
    throw new Error('Failed to decrypt provider key');
  }
}

/**
 * Mask an API key for display (show first 4 and last 4 characters)
 * @param apiKey - The API key to mask
 * @returns Masked key
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****';
  }
  
  const first4 = apiKey.substring(0, 4);
  const last4 = apiKey.substring(apiKey.length - 4);
  return `${first4}...${last4}`;
}

