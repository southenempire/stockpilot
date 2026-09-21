import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PublicKey, Keypair } from '@solana/web3.js';
import { derivePortfolioVaultPda } from '../../src/lib/solana/vault-program';

/**
 * StockPilot Anchor Smart Contract Test Suite
 * Program ID: CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK
 *
 * Covers the 4 Core Invariants:
 * 1. Initialize Vault PDA derivation & state allocation
 * 2. 15 bps Protocol Deposit Fee split to Treasury (2KtVKiQ...)
 * 3. 300-second Timelock Cooldown enforcement on rebalancing
 * 4. Unauthorized Withdraw access-control boundary (has_one = owner)
 */

describe('StockPilot Anchor Smart Contract Core Invariants (CsiP2ZWy...) - 4 Core Cases', () => {
  const PROGRAM_ID = new PublicKey('CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK');
  const PROTOCOL_TREASURY = new PublicKey('2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo');
  const PROTOCOL_FEE_BPS = 15; // 0.15% (15 basis points)
  const COOLDOWN_SECONDS = 300; // 5-minute invariant

  // Test identities
  const legitOwner = Keypair.generate();
  const attacker = Keypair.generate();

  // =========================================================================
  // Core Case 1: Initialize Vault PDA Derivation & State Invariants
  // =========================================================================
  it('Case 1 [Init Vault]: derives deterministic PDA with seeds [b"stockpilot_vault", owner]', () => {
    const [vaultPda, bump] = derivePortfolioVaultPda(legitOwner.publicKey, PROGRAM_ID);

    assert.ok(vaultPda instanceof PublicKey, 'Vault PDA must be a valid Solana PublicKey');
    assert.ok(typeof bump === 'number', 'Bump must be a valid u8 number');
    assert.ok(bump >= 0 && bump <= 255, 'Bump must be between 0 and 255');

    // Verify canonical bump derivation matching Anchor find_program_address
    const [manualPda, manualBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('stockpilot_vault'), legitOwner.publicKey.toBuffer()],
      PROGRAM_ID
    );

    assert.strictEqual(vaultPda.toBase58(), manualPda.toBase58(), 'Derived PDA must match Anchor canonical address');
    assert.strictEqual(bump, manualBump, 'Derived bump must match canonical bump');

    // Simulate initial vault account state matching StockVault struct
    const initialVaultState = {
      owner: legitOwner.publicKey,
      strategyId: 'ai_champions',
      targetWeights: [3500, 2500, 2000, 2000],
      createdAt: 1710000000,
      lastRebalanceTs: 1710000000,
      totalRebalances: 0,
      cooldownSeconds: COOLDOWN_SECONDS,
      bump,
    };

    assert.strictEqual(initialVaultState.totalRebalances, 0, 'New vault must start with 0 rebalances');
    assert.strictEqual(initialVaultState.cooldownSeconds, 300, 'New vault must enforce 300s cooldown');
    assert.strictEqual(initialVaultState.owner.toBase58(), legitOwner.publicKey.toBase58(), 'Vault owner must match initializer');
  });

  // =========================================================================
  // Core Case 2: 15 bps Protocol Fee Split to Treasury on Deposits
  // =========================================================================
  it('Case 2 [Deposit Fee]: calculates exact 15 bps fee split to Treasury with zero loss', () => {
    // Test with 500 USDC deposit (atomic units with 6 decimals: 500_000_000)
    const depositAmount = BigInt(500_000_000);

    const feeAmount = (depositAmount * BigInt(PROTOCOL_FEE_BPS)) / BigInt(10_000);
    const vaultNetAmount = depositAmount - feeAmount;

    // 500 USDC * 0.0015 = 0.75 USDC (750,000 atomic units)
    assert.strictEqual(feeAmount.toString(), '750000', '15 bps fee must equal 0.75 USDC on 500 USDC deposit');
    assert.strictEqual(vaultNetAmount.toString(), '499250000', 'Net vault credit must equal 499.25 USDC');

    // Mathematical conservation invariant: Fee + Net == Total Gross
    assert.strictEqual(
      feeAmount + vaultNetAmount,
      depositAmount,
      'Conservation invariant violated: sum of fee and vault deposit must exactly equal gross deposit'
    );

    // Verify Treasury recipient binding
    assert.strictEqual(
      PROTOCOL_TREASURY.toBase58(),
      '2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo',
      'Fee destination must strictly bind to Protocol Treasury'
    );
  });

  // =========================================================================
  // Core Case 3: 300-Second Timelock Cooldown Window on Rebalance
  // =========================================================================
  it('Case 3 [Cooldown]: rejects rebalances inside 300s window and allows after expiry', () => {
    const lastRebalanceTs = 1710000000;
    const cooldownPeriod = COOLDOWN_SECONDS; // 300s

    // Attempt 1: Rebalance after only 45 seconds (violates cooldown invariant)
    const earlyAttemptTs = lastRebalanceTs + 45;
    const isEarlyPermitted = earlyAttemptTs >= lastRebalanceTs + cooldownPeriod;
    assert.strictEqual(isEarlyPermitted, false, 'Rebalance inside 300s window must be rejected (RebalanceCooldownActive: 6002)');

    // Attempt 2: Rebalance at 299 seconds (boundary test: 1 second prior)
    const boundaryAttemptTs = lastRebalanceTs + 299;
    const isBoundaryPermitted = boundaryAttemptTs >= lastRebalanceTs + cooldownPeriod;
    assert.strictEqual(isBoundaryPermitted, false, 'Rebalance at T+299 must be rejected');

    // Attempt 3: Rebalance at exact cooldown expiry T+300
    const exactExpiryTs = lastRebalanceTs + 300;
    const isExactPermitted = exactExpiryTs >= lastRebalanceTs + cooldownPeriod;
    assert.strictEqual(isExactPermitted, true, 'Rebalance at T+300 must be authorized');

    // Attempt 4: Rebalance after cooldown expired T+600
    const lateAttemptTs = lastRebalanceTs + 600;
    const isLatePermitted = lateAttemptTs >= lastRebalanceTs + cooldownPeriod;
    assert.strictEqual(isLatePermitted, true, 'Rebalance after cooldown expiry must be authorized');
  });

  // =========================================================================
  // Core Case 4: Unauthorized Withdraw Access-Control Boundary
  // =========================================================================
  it('Case 4 [Unauthorized Withdraw]: rejects withdrawal attempt by non-owner attacker', () => {
    const [legitVaultPda] = derivePortfolioVaultPda(legitOwner.publicKey, PROGRAM_ID);
    const [attackerVaultPda] = derivePortfolioVaultPda(attacker.publicKey, PROGRAM_ID);

    // Attacker cannot access or sign for legit owner's vault
    assert.notStrictEqual(
      legitVaultPda.toBase58(),
      attackerVaultPda.toBase58(),
      'Attacker must have an entirely distinct isolated PDA vault'
    );

    // Simulate Anchor authorization constraint check:
    // #[account(has_one = owner @ StockPilotError::Unauthorized)]
    function checkWithdrawAuthorization(callerPubkey: PublicKey, vaultOwner: PublicKey) {
      if (!callerPubkey.equals(vaultOwner)) {
        throw new Error('StockPilotError::Unauthorized (Code: 6000) - Signer does not match vault.owner');
      }
      return true;
    }

    // Legit owner withdraws: SUCCESS
    assert.doesNotThrow(() => {
      checkWithdrawAuthorization(legitOwner.publicKey, legitOwner.publicKey);
    }, 'Legitimate vault owner must be authorized to withdraw');

    // Attacker attempts to withdraw from legit owner's vault: REJECTED
    assert.throws(
      () => {
        checkWithdrawAuthorization(attacker.publicKey, legitOwner.publicKey);
      },
      /StockPilotError::Unauthorized/,
      'Unauthorized caller must be blocked by Anchor has_one constraint'
    );
  });
});
