import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  createDepositInstruction,
  createInitializeVaultInstruction,
  createRebalanceInstruction,
  createWithdrawInstruction,
  createWithdrawSolInstruction,
  toBaseUnits,
} from '../src/lib/solana/contract-client';
import { derivePortfolioVaultPda } from '../src/lib/solana/vault-program';

/**
 * The IDL is the single source of truth (Solana Fall School §13): every instruction the app
 * sends must carry the IDL's discriminator and exactly the IDL's accounts, in order, with the
 * same signer/writable flags. A missing account (like the treasury account deposits used to
 * omit) fails here instead of on-chain.
 */
const IDL = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../anchor/idl/stockpilot.json'), 'utf8')
);

function assertMatchesIdl(name: string, ix: TransactionInstruction) {
  const spec = IDL.instructions.find((i: { name: string }) => i.name === name);
  assert.ok(spec, `${name} missing from IDL`);
  assert.strictEqual(ix.programId.toBase58(), IDL.address, `${name}: program id`);
  assert.deepStrictEqual([...ix.data.subarray(0, 8)], spec.discriminator, `${name}: discriminator`);
  assert.strictEqual(
    ix.keys.length,
    spec.accounts.length,
    `${name}: expected accounts ${spec.accounts.map((a: { name: string }) => a.name).join(', ')}`
  );
  spec.accounts.forEach((acc: { name: string; signer?: boolean; writable?: boolean }, i: number) => {
    assert.strictEqual(ix.keys[i].isSigner, !!acc.signer, `${name}.${acc.name}: signer flag`);
    assert.strictEqual(ix.keys[i].isWritable, !!acc.writable, `${name}.${acc.name}: writable flag`);
  });
}

describe('contract-client instructions match the on-chain IDL', () => {
  const owner = Keypair.generate().publicKey;
  const [vault] = derivePortfolioVaultPda(owner);
  const mint = Keypair.generate().publicKey;
  const accounts = Array.from({ length: 3 }, () => Keypair.generate().publicKey);

  it('initialize_vault', () => {
    const ix = createInitializeVaultInstruction(owner, vault, 'ai_champions', [5000, 5000]);
    assertMatchesIdl('initialize_vault', ix);
    // strategy_id: Borsh string (u32 length + bytes), then Vec<u16>
    assert.strictEqual(ix.data.readUInt32LE(8), 'ai_champions'.length);
  });

  it('deposit includes the treasury token account', () => {
    const ix = createDepositInstruction(owner, vault, mint, accounts[0], accounts[1], accounts[2], 1_000_000n);
    assertMatchesIdl('deposit', ix);
    assert.ok(ix.keys[5].pubkey.equals(accounts[2]), 'treasury token account in slot 5');
    assert.strictEqual(ix.data.readBigUInt64LE(8), 1_000_000n);
  });

  it('withdraw', () => {
    assertMatchesIdl('withdraw', createWithdrawInstruction(owner, vault, mint, accounts[0], accounts[1], 5n));
  });

  it('withdraw_sol', () => {
    assertMatchesIdl('withdraw_sol', createWithdrawSolInstruction(owner, vault, 5n));
  });

  it('rebalance', () => {
    assertMatchesIdl('rebalance', createRebalanceInstruction(owner, vault, [100, -100]));
  });

  it('vault PDA matches the IDL seeds', () => {
    const [manual] = PublicKey.findProgramAddressSync(
      [Buffer.from('stockpilot_vault'), owner.toBuffer()],
      new PublicKey(IDL.address)
    );
    assert.ok(vault.equals(manual));
  });
});

describe('toBaseUnits', () => {
  it('converts UI amounts without float truncation', () => {
    assert.strictEqual(Math.floor(2.01 * 1e6), 2_009_999); // the bug it avoids
    assert.strictEqual(toBaseUnits(2.01, 6), 2_010_000n);
    assert.strictEqual(toBaseUnits(0.05, 9), 50_000_000n);
    assert.strictEqual(toBaseUnits(0.000001, 6), 1n);
  });

  it('rejects negative and non-finite amounts', () => {
    assert.throws(() => toBaseUnits(-1, 6));
    assert.throws(() => toBaseUnits(Number.NaN, 6));
  });
});
