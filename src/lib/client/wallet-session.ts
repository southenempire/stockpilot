/**
 * Makes sure the browser holds a session cookie for `address` before calling the user APIs.
 * Only asks the wallet to sign when there is no valid session for this wallet yet; the
 * signature is an off-chain message, not a transaction, so it costs nothing.
 *
 * Returns false when the wallet cannot sign messages; throws if the user rejects or the
 * server refuses the signature.
 */
export async function ensureWalletSession(
  address: string,
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>
): Promise<boolean> {
  const current = await fetch('/api/auth/session').then((r) => r.json()).catch(() => null);
  if (current?.address === address) return true;
  if (!signMessage) return false;

  const challengeRes = await fetch('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const challenge = await challengeRes.json();
  if (!challengeRes.ok || !challenge.success) {
    throw new Error(challenge.error || 'Could not start wallet sign-in');
  }

  const signature = await signMessage(new TextEncoder().encode(challenge.message));

  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      message: challenge.message,
      challengeToken: challenge.challengeToken,
      signature: btoa(String.fromCharCode(...signature)),
    }),
  });
  const verified = await verifyRes.json();
  if (!verifyRes.ok || !verified.success) {
    throw new Error(verified.error || 'Wallet sign-in failed');
  }
  return true;
}
