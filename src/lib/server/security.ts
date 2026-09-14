import { createHmac } from 'node:crypto';

const USER_HASH_SALT =
  process.env.USER_HASH_SALT || 'stockpilot_secure_user_salt_2026_x89a';

/**
 * Computes a pseudonymous, one-way HMAC-SHA256 hash for a user's wallet address or Privy DID.
 * Raw wallet addresses and emails are never stored in plaintext on the database.
 */
export function hashUserId(rawIdentifier: string): string {
  if (!rawIdentifier || typeof rawIdentifier !== 'string') {
    throw new Error('Invalid raw user identifier for hashing');
  }
  return createHmac('sha256', USER_HASH_SALT)
    .update(rawIdentifier.trim().toLowerCase())
    .digest('hex');
}

/**
 * Sanitizes and truncates strings to protect against malformed inputs
 */
export function sanitizeString(val: any, maxLength: number = 255): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLength);
}
