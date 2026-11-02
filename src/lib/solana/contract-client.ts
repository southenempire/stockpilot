import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  derivePortfolioVaultPda,
  DEVNET_STOCK_MINTS,
  PROTOCOL_TREASURY_WALLET,
  PROTOCOL_FEE_BPS,
} from './vault-program';
import {
  getDepositInstruction,
  getInitializeVaultInstruction,
  getRebalanceInstruction,
  getWithdrawInstruction,
  getWithdrawSolInstruction,
} from '../../../clients/js/src/generated';
import { kitAddress, toWeb3Instruction, walletSigner } from './kit-adapter';

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

// Standard Devnet USDC Mint
export const DEVNET_USDC_MINT = new PublicKey(
  DEVNET_STOCK_MINTS.USDC || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

/**
 * Derive the Associated Token Account (ATA) address for any owner & mint
 */
export function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve: boolean = true,
  programId: PublicKey = TOKEN_PROGRAM_ID,
  associatedTokenProgramId: PublicKey = ASSOCIATED_TOKEN_PROGRAM_ID
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId
  );
  return address;
}

/**
 * Create idempotent Associated Token Account instruction
 */
export function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
  associatedTokenProgramId: PublicKey = ASSOCIATED_TOKEN_PROGRAM_ID
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
    ],
    programId: associatedTokenProgramId,
    data: Buffer.from([1]), // 1 = idempotent create
  });
}

/**
 * Converts a UI amount to integer base units without float truncation
 * (Math.floor(2.01 * 1e6) is 2009999, not 2010000).
 */
export function toBaseUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a positive number.');
  }
  const [whole, frac = ''] = amount.toFixed(decimals).split('.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

/**
 * Instruction to initialize the on-chain StockPilot Vault PDA
 */
export function createInitializeVaultInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  strategyId: string = 'ai_champions',
  targetWeights: number[] = [3500, 2500, 2000, 2000] // basis points
): TransactionInstruction {
  return toWeb3Instruction(
    getInitializeVaultInstruction({
      owner: walletSigner(owner),
      vault: kitAddress(vaultPda),
      strategyId,
      targetWeights,
    })
  );
}

/**
 * Direct SPL token transfer instruction for treasury fee collection
 */
export function createSplTokenTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint | number
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // 3 = Transfer
  data.writeBigUInt64LE(BigInt(Math.floor(Number(amount))), 1);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction to deposit SPL tokens (e.g. USDC) into the StockPilot Vault.
 * The program takes the 0.15% protocol fee into the treasury token account.
 */
export function createDepositInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  vaultTokenAccount: PublicKey,
  treasuryTokenAccount: PublicKey,
  amount: bigint | number
): TransactionInstruction {
  return toWeb3Instruction(
    getDepositInstruction({
      owner: walletSigner(owner),
      vault: kitAddress(vaultPda),
      mint: kitAddress(mint),
      ownerTokenAccount: kitAddress(ownerTokenAccount),
      vaultTokenAccount: kitAddress(vaultTokenAccount),
      treasuryTokenAccount: kitAddress(treasuryTokenAccount),
      amount: BigInt(amount),
    })
  );
}

/**
 * Instruction to withdraw SPL tokens (e.g. USDC) from the StockPilot Vault
 */
export function createWithdrawInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  mint: PublicKey,
  vaultTokenAccount: PublicKey,
  ownerTokenAccount: PublicKey,
  amount: bigint | number
): TransactionInstruction {
  return toWeb3Instruction(
    getWithdrawInstruction({
      owner: walletSigner(owner),
      vault: kitAddress(vaultPda),
      mint: kitAddress(mint),
      vaultTokenAccount: kitAddress(vaultTokenAccount),
      ownerTokenAccount: kitAddress(ownerTokenAccount),
      amount: BigInt(amount),
    })
  );
}

/**
 * Instruction to withdraw native SOL from the StockPilot Vault PDA
 */
export function createWithdrawSolInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  amountLamports: bigint | number
): TransactionInstruction {
  return toWeb3Instruction(
    getWithdrawSolInstruction({
      owner: walletSigner(owner),
      vault: kitAddress(vaultPda),
      amount: BigInt(amountLamports),
    })
  );
}

/**
 * Instruction to execute portfolio rebalancing with drift basis points
 */
export function createRebalanceInstruction(
  authority: PublicKey,
  vaultPda: PublicKey,
  driftBps: number[] = [0, 0, 0, 0]
): TransactionInstruction {
  return toWeb3Instruction(
    getRebalanceInstruction({
      authority: walletSigner(authority),
      vault: kitAddress(vaultPda),
      driftBps,
    })
  );
}

/**
 * High-level builder: Build a Deposit Transaction for USDC or SOL
 */
export async function buildDepositTransaction(
  connection: Connection,
  userPubkey: PublicKey,
  asset: 'USDC' | 'SOL',
  amount: number, // In natural units (e.g. 10 for 10 USDC, 0.05 for 0.05 SOL)
  strategyId: string = 'ai_champions',
  targetWeights: number[] = [3500, 2500, 2000, 2000]
): Promise<Transaction> {
  const [vaultPda] = derivePortfolioVaultPda(userPubkey);
  const tx = new Transaction();

  // Check if Vault account exists on-chain; if not, initialize it
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo || vaultInfo.data.length === 0) {
    tx.add(
      createInitializeVaultInstruction(userPubkey, vaultPda, strategyId, targetWeights)
    );
  }

  // Protocol fee split (0.15% = 15 bps)
  const feePercent = PROTOCOL_FEE_BPS / 10000;

  if (asset === 'SOL') {
    const totalLamports = Number(toBaseUnits(amount, 9));
    const feeLamports = Math.floor(totalLamports * feePercent);
    const vaultLamports = totalLamports - feeLamports;

    // 1. Send 0.15% fee directly to StockPilot Protocol Treasury Wallet
    if (feeLamports > 0) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: PROTOCOL_TREASURY_WALLET,
          lamports: feeLamports,
        })
      );
    }

    // 2. Deposit remaining 99.85% net into user's non-custodial Vault PDA
    tx.add(
      SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: vaultPda,
        lamports: vaultLamports,
      })
    );
  } else {
    // USDC deposit (6 decimals)
    const totalAmountU64 = toBaseUnits(amount, 6);

    const userAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, userPubkey);
    const vaultAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, vaultPda, true);
    const treasuryAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, PROTOCOL_TREASURY_WALLET, true);

    // Ensure user ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,
        userAta,
        userPubkey,
        DEVNET_USDC_MINT
      )
    );

    // Ensure vault ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,
        vaultAta,
        vaultPda,
        DEVNET_USDC_MINT
      )
    );

    // Ensure treasury ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,
        treasuryAta,
        PROTOCOL_TREASURY_WALLET,
        DEVNET_USDC_MINT
      )
    );

    // Deposit with on-chain 0.15% protocol fee slice
    tx.add(
      createDepositInstruction(
        userPubkey,
        vaultPda,
        DEVNET_USDC_MINT,
        userAta,
        vaultAta,
        treasuryAta,
        totalAmountU64
      )
    );
  }

  tx.feePayer = userPubkey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  return tx;
}

/**
 * High-level builder: Build a Withdraw Transaction for USDC or SOL
 */
export async function buildWithdrawTransaction(
  connection: Connection,
  userPubkey: PublicKey,
  asset: 'USDC' | 'SOL',
  amount: number
): Promise<Transaction> {
  const [vaultPda] = derivePortfolioVaultPda(userPubkey);
  const tx = new Transaction();

  if (asset === 'SOL') {
    let lamports = Number(toBaseUnits(amount, 9));
    const vaultInfo = await connection.getAccountInfo(vaultPda);

    if (!vaultInfo) {
      throw new Error('Vault account not found on-chain. Deposit funds first.');
    }

    // Determine rent-exempt minimum so withdrawing doesn't trigger InsufficientFundsForRent
    const rentExemptMin = await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length || 129);
    const maxWithdrawableLamports = vaultInfo.lamports > rentExemptMin ? vaultInfo.lamports - rentExemptMin : 0;

    if (maxWithdrawableLamports <= 0) {
      throw new Error(
        `Vault balance (${(vaultInfo.lamports / 1e9).toFixed(4)} SOL) is required to maintain Solana rent-exemption (${(rentExemptMin / 1e9).toFixed(4)} SOL). No excess SOL available.`
      );
    }

    if (lamports > maxWithdrawableLamports) {
      lamports = maxWithdrawableLamports;
    }

    // If the vault is an initialized Anchor account, invoke withdraw_sol
    // If it's a pure lamport deposit without anchor init, initialize first so PDA can authorize withdraw_sol
    if (vaultInfo.data.length > 0) {
      tx.add(createWithdrawSolInstruction(userPubkey, vaultPda, lamports));
    } else {
      tx.add(createInitializeVaultInstruction(userPubkey, vaultPda));
      tx.add(createWithdrawSolInstruction(userPubkey, vaultPda, lamports));
    }
  } else {
    // USDC withdrawal (6 decimals)
    const amountU64 = toBaseUnits(amount, 6);
    const userAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, userPubkey);
    const vaultAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, vaultPda, true);

    // Ensure user ATA exists to receive USDC
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,
        userAta,
        userPubkey,
        DEVNET_USDC_MINT
      )
    );

    // Ensure vault ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,
        vaultAta,
        vaultPda,
        DEVNET_USDC_MINT
      )
    );

    // Call Anchor withdraw instruction
    tx.add(
      createWithdrawInstruction(
        userPubkey,
        vaultPda,
        DEVNET_USDC_MINT,
        vaultAta,
        userAta,
        amountU64
      )
    );
  }

  tx.feePayer = userPubkey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  return tx;
}

/**
 * High-level builder: Build a Rebalance Transaction
 */
export async function buildRebalanceTransaction(
  connection: Connection,
  userPubkey: PublicKey,
  driftBps: number[]
): Promise<Transaction> {
  const [vaultPda] = derivePortfolioVaultPda(userPubkey);
  const tx = new Transaction();

  // Ensure vault initialized
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo || vaultInfo.data.length === 0) {
    tx.add(createInitializeVaultInstruction(userPubkey, vaultPda));
  }

  tx.add(createRebalanceInstruction(userPubkey, vaultPda, driftBps));

  tx.feePayer = userPubkey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  return tx;
}
