/**
 * Creates the devnet demo market for autopilot rebalancing:
 *   - mock tokenized-stock mints (NVDAx, AAPLx, MSFTx, TSLAx), mint authority = admin wallet
 *   - the oracle pool PDA owned by the StockPilot program
 *   - pool liquidity in each mint
 * Safe to re-run: existing mints and the pool are reused, liquidity is topped up to the target.
 *
 *   npx tsx scripts/setup-devnet-pool.ts
 *
 * Env: SOLANA_KEYPAIR (default ~/.config/solana/id.json), SOLANA_RPC_URL (default devnet).
 * Writes anchor/devnet.json for the keeper and the app.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '../src/lib/solana/contract-client';

const ROOT = path.resolve(__dirname, '..');
const IDL = JSON.parse(fs.readFileSync(path.join(ROOT, 'anchor/idl/stockpilot.json'), 'utf8'));
const OUT = path.join(ROOT, 'anchor/devnet.json');
const PROGRAM_ID = new PublicKey(IDL.address);

const DECIMALS = 6;
const SPREAD_BPS = 30;
const POOL_LIQUIDITY = 10_000n * 10n ** BigInt(DECIMALS);

// Pyth feed ids, checked against https://hermes.pyth.network/v2/price_feeds
const ASSETS = [
  { symbol: 'NVDAx', ticker: 'Equity.US.NVDA/USD', feedId: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
  { symbol: 'AAPLx', ticker: 'Equity.US.AAPL/USD', feedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
  { symbol: 'MSFTx', ticker: 'Equity.US.MSFT/USD', feedId: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1' },
  { symbol: 'TSLAx', ticker: 'Equity.US.TSLA/USD', feedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
];

interface DevnetState {
  programId: string;
  pool: string;
  poolAdmin: string;
  spreadBps: number;
  assets: {
    symbol: string;
    ticker: string;
    feedId: string;
    mint: string;
    decimals: number;
    poolTokenAccount: string;
  }[];
}

function idlDiscriminator(name: string): Buffer {
  const ix = IDL.instructions.find((i: { name: string }) => i.name === name);
  if (!ix) throw new Error(`instruction ${name} missing from IDL`);
  return Buffer.from(ix.discriminator);
}

function initializeMint2(mint: PublicKey, decimals: number, authority: PublicKey) {
  const data = Buffer.alloc(35);
  data[0] = 20; // InitializeMint2
  data[1] = decimals;
  authority.toBuffer().copy(data, 2);
  data[34] = 0; // no freeze authority
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    data,
  });
}

function mintTo(mint: PublicKey, dest: PublicKey, authority: PublicKey, amount: bigint) {
  const data = Buffer.alloc(9);
  data[0] = 7; // MintTo
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

async function main() {
  const keypairPath = process.env.SOLANA_KEYPAIR ?? path.join(os.homedir(), '.config/solana/id.json');
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
  const send = (tx: Transaction, signers: Keypair[]) =>
    sendAndConfirmTransaction(connection, tx, [admin, ...signers], { commitment: 'confirmed' });

  const previous: DevnetState | null = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from('oracle_pool'), admin.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`Admin ${admin.publicKey.toBase58()}  Pool ${pool.toBase58()}`);

  if (!(await connection.getAccountInfo(pool))) {
    const data = Buffer.alloc(10);
    idlDiscriminator('init_oracle_pool').copy(data, 0);
    data.writeUInt16LE(SPREAD_BPS, 8);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    console.log(`init_oracle_pool: ${await send(new Transaction().add(ix), [])}`);
  } else {
    console.log('Pool already exists');
  }

  const rent = await connection.getMinimumBalanceForRentExemption(82);
  const assets: DevnetState['assets'] = [];
  for (const asset of ASSETS) {
    const known = previous?.assets.find((a) => a.symbol === asset.symbol);
    let mint = known && (await connection.getAccountInfo(new PublicKey(known.mint))) ? new PublicKey(known.mint) : null;

    if (!mint) {
      const mintKp = Keypair.generate();
      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: admin.publicKey,
          newAccountPubkey: mintKp.publicKey,
          lamports: rent,
          space: 82,
          programId: TOKEN_PROGRAM_ID,
        }),
        initializeMint2(mintKp.publicKey, DECIMALS, admin.publicKey)
      );
      console.log(`${asset.symbol} mint ${mintKp.publicKey.toBase58()}: ${await send(tx, [mintKp])}`);
      mint = mintKp.publicKey;
    }

    const poolAta = getAssociatedTokenAddressSync(mint, pool, true);
    const existing = await connection.getTokenAccountBalance(poolAta).catch(() => null);
    const current = existing ? BigInt(existing.value.amount) : 0n;
    if (current < POOL_LIQUIDITY) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, poolAta, pool, mint),
        mintTo(mint, poolAta, admin.publicKey, POOL_LIQUIDITY - current)
      );
      console.log(`${asset.symbol} pool liquidity -> ${POOL_LIQUIDITY / 10n ** BigInt(DECIMALS)}: ${await send(tx, [])}`);
    } else {
      console.log(`${asset.symbol} pool already funded`);
    }

    assets.push({ ...asset, mint: mint.toBase58(), decimals: DECIMALS, poolTokenAccount: poolAta.toBase58() });
  }

  const state: DevnetState = {
    programId: PROGRAM_ID.toBase58(),
    pool: pool.toBase58(),
    poolAdmin: admin.publicKey.toBase58(),
    spreadBps: SPREAD_BPS,
    assets,
  };
  fs.writeFileSync(OUT, JSON.stringify(state, null, 2) + '\n');
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
