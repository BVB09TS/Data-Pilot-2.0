import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // GCM standard
const TAG_LENGTH = 16;
const SALT = 'datapilot-ai-governance'; // fixed salt — key derivation only

function getKey(): Buffer {
  const secret = process.env.SERVER_SECRET;
  if (!secret) throw new Error('SERVER_SECRET env var is required for encryption');
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv(12) + tag(16) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: iv | tag | ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64 string produced by `encrypt()`.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, 'base64');

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}
