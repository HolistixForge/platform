import crypto from 'crypto';
import { CONFIG } from '../config';

/**
 * Credentials Encryption Service
 *
 * Uses AES-256-GCM encryption for credential values.
 * Supports key versioning for future key rotation.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const SALT_LENGTH = 32; // 32 bytes for key derivation salt

/**
 * Current encryption key version
 * Increment when rotating keys
 */
export const CURRENT_KEY_VERSION = 'v1';

/**
 * Derive a 256-bit key from the master key using PBKDF2
 * This allows using a human-readable master key
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
}

/**
 * Get the master encryption key for a given version
 * Future: Support multiple key versions for rotation
 */
function getMasterKey(keyVersion: string): string {
  if (keyVersion === 'v1') {
    return CONFIG.CREDENTIALS_ENCRYPTION_KEY;
  }
  throw new Error(`Unknown encryption key version: ${keyVersion}`);
}

/**
 * Encrypt a credential value
 *
 * Format: base64(salt + iv + authTag + ciphertext)
 *
 * @param plaintext - The credential value to encrypt
 * @param keyVersion - The encryption key version to use (default: current)
 * @returns Encrypted value as base64 string
 */
export function encryptCredential(
  plaintext: string,
  keyVersion: string = CURRENT_KEY_VERSION
): string {
  const masterKey = getMasterKey(keyVersion);

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from master key
  const key = deriveKey(masterKey, salt);

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a credential value
 *
 * @param encryptedValue - The encrypted value (base64)
 * @param keyVersion - The encryption key version used
 * @returns Decrypted plaintext value
 */
export function decryptCredential(
  encryptedValue: string,
  keyVersion: string
): string {
  const masterKey = getMasterKey(keyVersion);

  // Decode from base64
  const combined = Buffer.from(encryptedValue, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = combined.subarray(
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );

  // Derive key from master key
  const key = deriveKey(masterKey, salt);

  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Re-encrypt a credential with a new key version
 * Used during key rotation
 *
 * @param encryptedValue - Current encrypted value
 * @param oldKeyVersion - Version of key used for current encryption
 * @param newKeyVersion - Version of new key to use
 * @returns Re-encrypted value with new key
 */
export function reencryptCredential(
  encryptedValue: string,
  oldKeyVersion: string,
  newKeyVersion: string = CURRENT_KEY_VERSION
): string {
  const plaintext = decryptCredential(encryptedValue, oldKeyVersion);
  return encryptCredential(plaintext, newKeyVersion);
}
