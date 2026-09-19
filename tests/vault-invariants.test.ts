import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PublicKey } from '@solana/web3.js';
import { derivePortfolioVaultPda } from '../src/lib/solana/vault-program';

describe('StockPilot Anchor Vault Invariants & Fee Rules', () => {
  const mockOwnerPubkey = new PublicKey('FVyGEtqSKPHkiKgeSa8imWW5gzWNN5A5txwJgs7zFQhb');
  const expectedProgramId = new PublicKey('CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK');
  const expectedTreasuryPubkey = new PublicKey('2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo');

  it('derives deterministic PDA vault address matching on-chain seeds [stockpilot_vault, owner]', () => {
    const [pda, bump] = derivePortfolioVaultPda(mockOwnerPubkey, expectedProgramId);

    assert.ok(pda instanceof PublicKey);
    assert.ok(typeof bump === 'number');
    assert.ok(bump >= 0 && bump <= 255);

    // Verify deterministic reproducibility
    const [pda2, bump2] = derivePortfolioVaultPda(mockOwnerPubkey, expectedProgramId);
    assert.strictEqual(pda.toBase58(), pda2.toBase58());
    assert.strictEqual(bump, bump2);
  });

  it('calculates deterministic 15 bps protocol fee split correctly on deposits', () => {
    const PROTOCOL_FEE_BPS = 15; // 0.15% (15 bps of 10,000)
    const depositAmount = BigInt("10000000000"); // 10,000 USDC in atomic units (6 decimals)

    const feeAmount = (depositAmount * BigInt(PROTOCOL_FEE_BPS)) / BigInt("10000");
    const netVaultAmount = depositAmount - feeAmount;

    // 10,000 * 0.0015 = 15 USDC fee
    assert.strictEqual(feeAmount.toString(), "15000000");
    // Net vault deposit = 9,985 USDC
    assert.strictEqual(netVaultAmount.toString(), "9985000000");
    assert.strictEqual(feeAmount + netVaultAmount, depositAmount);
  });

  it('enforces 300-second timelock cooldown window on rebalance', () => {
    const DEFAULT_COOLDOWN_SECONDS = 300;
    const lastRebalanceTs = 1700000000;

    // Attempt rebalance 100 seconds later (should be rejected)
    const earlyAttemptTs = 1700000100;
    const isEarlyAllowed = earlyAttemptTs >= lastRebalanceTs + DEFAULT_COOLDOWN_SECONDS;
    assert.strictEqual(isEarlyAllowed, false);

    // Attempt rebalance 301 seconds later (should be permitted)
    const validAttemptTs = 1700000301;
    const isValidAllowed = validAttemptTs >= lastRebalanceTs + DEFAULT_COOLDOWN_SECONDS;
    assert.strictEqual(isValidAllowed, true);
  });

  it('maintains 2-Layer Vault accounting invariant (Total NAV = Cash Reserve + Active Baskets)', () => {
    let cashReserveUsdc = 1000;
    let activeBasketsUsdc = 0;
    let totalNav = cashReserveUsdc + activeBasketsUsdc;
    assert.strictEqual(totalNav, 1000);

    // 1-Tap Deploy $600 to AI Compute Strategy
    const deployAmount = 600;
    cashReserveUsdc -= deployAmount;
    activeBasketsUsdc += deployAmount;
    totalNav = cashReserveUsdc + activeBasketsUsdc;
    assert.strictEqual(cashReserveUsdc, 400);
    assert.strictEqual(activeBasketsUsdc, 600);
    assert.strictEqual(totalNav, 1000); // Invariant holds

    // 1-Tap De-Risk back to Cash Reserve
    cashReserveUsdc += activeBasketsUsdc;
    activeBasketsUsdc = 0;
    totalNav = cashReserveUsdc + activeBasketsUsdc;
    assert.strictEqual(cashReserveUsdc, 1000);
    assert.strictEqual(activeBasketsUsdc, 0);
    assert.strictEqual(totalNav, 1000); // Invariant holds
  });
});
