import { NextRequest, NextResponse } from 'next/server';
import { getSessionAddress } from './auth';

/**
 * Wallet address for a user API request, taken from the signed session cookie.
 * If the request also names a wallet (legacy `rawIdentifier`), it must be the same one.
 */
export function requireSession(
  req: NextRequest,
  claimedIdentifier?: unknown
): { address: string } | { response: NextResponse } {
  const address = getSessionAddress(req);
  if (!address) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Sign in with your wallet first' },
        { status: 401 }
      ),
    };
  }
  if (claimedIdentifier && claimedIdentifier !== address) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Signed-in wallet does not match the requested wallet' },
        { status: 403 }
      ),
    };
  }
  return { address };
}
