import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Wallet-signature sessions for the user APIs.
 *
 * 1. POST /api/auth/challenge  -> a sign-in message plus an HMAC of it (stateless, 5 min)
 * 2. The wallet signs the message (ed25519, no transaction, no fee)
 * 3. POST /api/auth/verify     -> server checks the HMAC, expiry and signature, then sets
 *                                 an httpOnly session cookie bound to that wallet (7 days)
 *
 * User routes read the wallet address from the cookie instead of trusting the request body,
 * so nobody can read or write another wallet's data just by knowing its public address.
 */

export const SESSION_COOKIE = 'sp_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MESSAGE_HEADER = 'Sign in to StockPilot';

export class AuthConfigError extends Error {}

const globalForAuth = globalThis as unknown as { stockpilotDevAuthSecret?: Buffer };

function authSecret(): Buffer {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return Buffer.from(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new AuthConfigError('AUTH_SECRET (32+ characters) must be set to enable sign-in.');
  }
  // Local development: a per-process secret. Sessions end when the dev server restarts.
  globalForAuth.stockpilotDevAuthSecret ??= randomBytes(32);
  return globalForAuth.stockpilotDevAuthSecret;
}

function hmac(value: string): string {
  return createHmac('sha256', authSecret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function isWalletAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false;
  try {
    return new PublicKey(address).toBase58() === address;
  } catch {
    return false;
  }
}

export function createChallenge(address: string): { message: string; challengeToken: string } {
  if (!isWalletAddress(address)) throw new Error('Invalid wallet address');
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const message = [
    MESSAGE_HEADER,
    '',
    'This only proves you own this wallet. It is not a transaction and costs nothing.',
    '',
    `Wallet: ${address}`,
    `Nonce: ${randomBytes(16).toString('hex')}`,
    `Expires: ${expiresAt}`,
  ].join('\n');
  return { message, challengeToken: hmac(message) };
}

/** Ed25519 check of a Solana wallet's signMessage output. */
function verifyWalletSignature(address: string, message: string, signature: Buffer): boolean {
  const key = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: new PublicKey(address).toBuffer().toString('base64url') },
    format: 'jwk',
  });
  return verify(null, Buffer.from(message, 'utf8'), key, signature);
}

/** Returns the verified wallet address, or throws with a reason safe to show the user. */
export function verifyChallenge(input: {
  address: unknown;
  message: unknown;
  challengeToken: unknown;
  signature: unknown;
}): string {
  const { address, message, challengeToken, signature } = input;
  if (!isWalletAddress(address)) throw new Error('Invalid wallet address');
  if (typeof message !== 'string' || typeof challengeToken !== 'string' || typeof signature !== 'string') {
    throw new Error('Missing sign-in fields');
  }
  if (!safeEqual(hmac(message), challengeToken)) throw new Error('Unknown sign-in challenge');

  const lines = message.split('\n');
  if (lines[0] !== MESSAGE_HEADER || !lines.includes(`Wallet: ${address}`)) {
    throw new Error('Challenge was issued for a different wallet');
  }
  const expires = Date.parse(lines.find((l) => l.startsWith('Expires: '))?.slice(9) ?? '');
  if (!Number.isFinite(expires) || expires < Date.now()) throw new Error('Sign-in challenge expired');

  const sig = Buffer.from(signature, 'base64');
  if (sig.length !== 64 || !verifyWalletSignature(address, message, sig)) {
    throw new Error('Signature does not match this wallet');
  }
  return address;
}

export function setSessionCookie(res: NextResponse, address: string): void {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${address}.${expires}`;
  res.cookies.set(SESSION_COOKIE, `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Wallet address of the signed-in user, or null. */
export function getSessionAddress(req: NextRequest): string | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [address, expires, mac] = parts;
  try {
    if (!safeEqual(hmac(`${address}.${expires}`), mac)) return null;
  } catch {
    return null; // AUTH_SECRET missing in production: nobody is signed in
  }
  if (Number(expires) * 1000 < Date.now() || !isWalletAddress(address)) return null;
  return address;
}
