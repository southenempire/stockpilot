import { Connection } from '@solana/web3.js';

const SIM_PREFIX = 'sim_';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Id for an action that only happened in the local sandbox (no transaction was sent).
 * The `sim_` prefix keeps it from ever being mistaken for, or linked as, a real signature.
 */
export function simulatedSignature(): string {
  return SIM_PREFIX + Array.from({ length: 40 }, () => BASE58[Math.floor(Math.random() * 58)]).join('');
}

export function isSimulatedSignature(sig: string | undefined | null): boolean {
  return !sig || sig.startsWith(SIM_PREFIX);
}

/** Solscan link for a real devnet signature, or null for sandbox-only actions. */
export function txExplorerUrl(sig: string | undefined | null): string | null {
  return isSimulatedSignature(sig) ? null : `https://solscan.io/tx/${sig}?cluster=devnet`;
}

/**
 * Waits for a transaction and throws if it failed on-chain or never landed.
 * `confirmTransaction` resolves (it does not throw) when a transaction fails,
 * so `value.err` has to be checked explicitly.
 */
export async function confirmOrThrow(connection: Connection, signature: string): Promise<void> {
  let err: unknown = null;
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    err = res.value.err;
  } catch {
    // Confirmation timed out or the websocket dropped: ask the cluster directly.
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    if (!status.value) {
      throw new Error(
        `Transaction ${signature.slice(0, 8)}… was not confirmed. Check Solscan before retrying.`
      );
    }
    err = status.value.err;
  }
  if (err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(err)}`);
  }
}
