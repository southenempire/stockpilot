import { PublicKey } from '@solana/web3.js';

// StockPilot Program Derived Address (PDA) Seeds
export const VAULT_SEED_PREFIX = 'stockpilot_vault';
export const PORTFOLIO_STATE_PREFIX = 'stockpilot_portfolio';

// StockPilot Protocol Treasury Wallet & Monetization Engine
// 15 basis points = 0.15% protocol fee transferred on-chain directly to treasury on every trade & rebalance
export const PROTOCOL_FEE_BPS = 15; // 0.15%
export const PROTOCOL_TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS || '2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo'
);

export function calculateProtocolFee(amount: number): {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  feePercent: number;
} {
  const feePercent = PROTOCOL_FEE_BPS / 10000; // 0.0015
  const feeAmount = amount * feePercent;
  const netAmount = amount - feeAmount;
  return {
    grossAmount: amount,
    feeAmount,
    netAmount,
    feePercent: 0.15,
  };
}

// Cooldown interval between automated rebalances to protect user from excessive slippage
export const DEFAULT_REBALANCE_COOLDOWN_SECONDS = 3600; // 1 hour

export const STOCKPILOT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_STOCKPILOT_PROGRAM_ID || 'CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK'
);

/**
 * Derives the PDA address for a user's stock portfolio vault
 * Uses pattern from Solana Fall School vault challenge
 */
export function derivePortfolioVaultPda(
  userPublicKey: PublicKey,
  programId: PublicKey = STOCKPILOT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED_PREFIX), userPublicKey.toBuffer()],
    programId
  );
}

/**
 * Verifies if rebalance cooldown has expired based on Solana Clock sysvar
 * Uses pattern from Solana Fall School escrow timelock challenge
 */
export function isRebalanceCooldownActive(
  lastRebalancedTimestampSec: number,
  cooldownSeconds: number = DEFAULT_REBALANCE_COOLDOWN_SECONDS
): {
  isActive: boolean;
  remainingSeconds: number;
  unlockTimestamp: number;
} {
  const currentTimestampSec = Math.floor(Date.now() / 1000);
  const unlockTimestamp = lastRebalancedTimestampSec + cooldownSeconds;
  const remainingSeconds = Math.max(0, unlockTimestamp - currentTimestampSec);

  return {
    isActive: remainingSeconds > 0,
    remainingSeconds,
    unlockTimestamp
  };
}

/**
 * Tokenized Stock SPL Mint Addresses on Solana Devnet (Mocked for testing / demo)
 */
export const DEVNET_STOCK_MINTS: Record<string, string> = {
  USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  xNVDA: 'Nvda111111111111111111111111111111111111111',
  xAAPL: 'AppL111111111111111111111111111111111111111',
  xMSFT: 'Msft111111111111111111111111111111111111111',
  xTSLA: 'TsLa111111111111111111111111111111111111111',
  xTSM: 'Tsm1111111111111111111111111111111111111111',
  xAMD: 'Amd1111111111111111111111111111111111111111',
  xCOIN: 'Coin111111111111111111111111111111111111111',
  xJNJ: 'Jnj1111111111111111111111111111111111111111',
  xPG: 'Pg11111111111111111111111111111111111111111'
};
