import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  STOCKPILOT_PROGRAM_ID,
  derivePortfolioVaultPda,
  DEVNET_STOCK_MINTS,
  PROTOCOL_TREASURY_WALLET,
  PROTOCOL_FEE_BPS,
} from './vault-program';

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

// Anchor Instruction Discriminators from stockpilot IDL
const DISCRIMINATORS = {
  initialize_vault: Buffer.from([48, 191, 163, 44, 71, 129, 63, 164]),
  deposit: Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]),
  withdraw: Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]),
  withdraw_sol: Buffer.from([145, 131, 74, 136, 65, 137, 42, 38]),
  rebalance: Buffer.from([108, 158, 77, 9, 210, 52, 88, 62]),
};

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

function encodeU64(amount: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(Math.floor(Number(amount))), 0);
  return buf;
}

function encodeString(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

function encodeU16Vec(values: number[]): Buffer {
  const buf = Buffer.alloc(4 + values.length * 2);
  buf.writeUInt32LE(values.length, 0);
  values.forEach((v, i) => {
    buf.writeUInt16LE(v, 4 + i * 2);
  });
  return buf;
}

function encodeI16Vec(values: number[]): Buffer {
  const buf = Buffer.alloc(4 + values.length * 2);
  buf.writeUInt32LE(values.length, 0);
  values.forEach((v, i) => {
    buf.writeInt16LE(v, 4 + i * 2);
  });
  return buf;
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
  const data = Buffer.concat([
    DISCRIMINATORS.initialize_vault,
    encodeString(strategyId),
    encodeU16Vec(targetWeights),
  ]);

  return new TransactionInstruction({
    programId: STOCKPILOT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
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
 * Instruction to deposit SPL tokens (e.g. USDC) into the StockPilot Vault
 */
export function createDepositInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  vaultTokenAccount: PublicKey,
  amount: bigint | number
): TransactionInstruction {
  const data = Buffer.concat([DISCRIMINATORS.deposit, encodeU64(amount)]);

  return new TransactionInstruction({
    programId: STOCKPILOT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
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
  const data = Buffer.concat([DISCRIMINATORS.withdraw, encodeU64(amount)]);

  return new TransactionInstruction({
    programId: STOCKPILOT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction to withdraw native SOL from the StockPilot Vault PDA
 */
export function createWithdrawSolInstruction(
  owner: PublicKey,
  vaultPda: PublicKey,
  amountLamports: bigint | number
): TransactionInstruction {
  const data = Buffer.concat([
    DISCRIMINATORS.withdraw_sol,
    encodeU64(amountLamports),
  ]);

  return new TransactionInstruction({
    programId: STOCKPILOT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction to execute portfolio rebalancing with drift basis points
 */
export function createRebalanceInstruction(
  authority: PublicKey,
  vaultPda: PublicKey,
  driftBps: number[] = [0, 0, 0, 0]
): TransactionInstruction {
  const data = Buffer.concat([
    DISCRIMINATORS.rebalance,
    encodeI16Vec(driftBps),
  ]);

  return new TransactionInstruction({
    programId: STOCKPILOT_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
    ],
    data,
  });
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
    const totalLamports = Math.floor(amount * 1_000_000_000);
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
    const totalAmountU64 = BigInt(Math.floor(amount * 1_000_000));
    const feeUnits = BigInt(Math.floor(Number(totalAmountU64) * feePercent));
    const vaultUnits = totalAmountU64 - feeUnits;

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

    // 1. Send 0.15% fee to Treasury USDC ATA
    if (feeUnits > BigInt(0)) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,
          treasuryAta,
          PROTOCOL_TREASURY_WALLET,
          DEVNET_USDC_MINT
        )
      );
      tx.add(
        createSplTokenTransferInstruction(
          userAta,
          treasuryAta,
          userPubkey,
          feeUnits
        )
      );
    }

    // 2. Deposit remaining 99.85% net into user's non-custodial Vault PDA
    tx.add(
      createDepositInstruction(
        userPubkey,
        vaultPda,
        DEVNET_USDC_MINT,
        userAta,
        vaultAta,
        vaultUnits
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
    const lamports = Math.floor(amount * 1_000_000_000);
    const vaultInfo = await connection.getAccountInfo(vaultPda);

    // If the vault is an initialized Anchor account, invoke withdraw_sol
    // If it's a pure lamport deposit without anchor init, initialize first so PDA can authorize withdraw_sol
    if (vaultInfo && vaultInfo.data.length > 0) {
      tx.add(createWithdrawSolInstruction(userPubkey, vaultPda, lamports));
    } else {
      tx.add(createInitializeVaultInstruction(userPubkey, vaultPda));
      tx.add(createWithdrawSolInstruction(userPubkey, vaultPda, lamports));
    }
  } else {
    // USDC withdrawal (6 decimals)
    const amountU64 = BigInt(Math.floor(amount * 1_000_000));
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
