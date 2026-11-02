// Kit → web3.js adapter (Solana Fall School, Codama challenge pattern)
//
// The Codama client in clients/js is generated from anchor/idl/stockpilot.json and
// targets @solana/kit, while the wallet adapters in this app still sign
// @solana/web3.js v1 transactions. The two describe an instruction differently:
//
//   kit      { programAddress, accounts: [{ address, role }], data }
//   web3.js  { programId,      keys:     [{ pubkey, isSigner, isWritable }], data }
//
// Building with the generated client and converting here keeps the IDL as the single
// source of truth for discriminators, account order and argument layout.

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { address, createNoopSigner, isSignerRole, isWritableRole, type Instruction } from '@solana/kit';

export function toWeb3Instruction(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((account) => ({
      pubkey: new PublicKey(account.address),
      isSigner: isSignerRole(account.role),
      isWritable: isWritableRole(account.role),
    })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });
}

/** Kit address for a web3.js key. */
export function kitAddress(key: PublicKey) {
  return address(key.toBase58());
}

/** Placeholder signer: the wallet adapter adds the real signature when the transaction is sent. */
export function walletSigner(key: PublicKey) {
  return createNoopSigner(kitAddress(key));
}
