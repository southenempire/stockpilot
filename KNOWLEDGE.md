# Solana Development Knowledge Base

## Class Reference: Week 4 Day 2 — Codama & IDLs
**Date:** September 23, 2026  
**Topic:** *Describe your program once, generate every client*

---

### 1. The Core Problem: Why IDLs Matter
* **The Rule Enforcer:** The on-chain Solana program (Rust / Anchor / Pinocchio) enforces strict validation:
  - Account ordering, signer requirements, and writability flags
  - Instruction discriminators (8 bytes for Anchor, custom 1 byte for native/Pinocchio)
  - Account serialization layouts (Borsh)
  - PDA seed derivation algorithms
  - Custom error codes
* **The IDL (Interface Definition Language):** A machine-readable JSON specification representing these exact rules in a single source of truth.
* **Why Traditional Hand-Written Clients Fail:**
  - Callers must manually construct buffers, discriminators, and account meta arrays.
  - Any drift in account order or struct field layout causes runtime transaction failures on-chain.
  - With generated clients, drift becomes an instant compile-time error (`tsc`).

---

### 2. What is Codama?
* **Origin & Maintenance:** Formerly Metaplex's Kinobi (used for `mpl-core`), now maintained by **Anza** and **Metaplex**.
* **Architecture:**
  1. Input: Anchor IDL (`target/idl/<program>.json`), Shank IDL, Codama Macros, or manual AST nodes.
  2. Intermediate Representation: A tree of 60+ AST node types (`pdaNode`, `instructionNode`, `accountNode`, etc.).
  3. Transformation Pipeline: Visitors walk and transform the tree (rename instructions, set account defaults, strip documentation, update types).
  4. Renderers: Output typed client libraries across multiple target languages and frameworks:
     - `@codama/renderers-js`: Modern TypeScript client for `@solana/kit` (v8.3+)
     - `@codama/renderers-js-umi`: Metaplex Umi framework
     - `@codama/renderers-rust`: Native Rust SDK & CPI builders
     - `@codama/renderers-go`: Go SDK client
     - `@codama/renderers-vixen-parser`: Yellowstone indexer parsers

---

### 3. Codama Configuration & CLI Workflow

#### `codama.json` Structure
```json
{
  "idl": "target/idl/fundraiser.json",
  "before": [
    {
      "from": "@codama/visitors#updateInstructionsVisitor",
      "args": [{ "checkContributions": { "name": "claim" } }]
    }
  ],
  "scripts": {
    "js": {
      "from": "@codama/renderers-js",
      "args": ["clients/js"]
    },
    "rust": {
      "from": "@codama/renderers-rust",
      "args": ["clients/rust", { "crateFolder": "clients/rust" }]
    }
  }
}
```

#### Core CLI Commands
```bash
# Initialize Codama configuration from an Anchor IDL
npx codama init

# Run specific renderer / pipeline script
npx codama run js

# Run all scripts defined in codama.json
npx codama run --all
```

---

### 4. Consuming Generated Clients with `@solana/kit`
Kit (`@solana/kit`) is the modern, functional, tree-shakeable successor to legacy `@solana/web3.js` (v1).

* **Account Decoders:**
  ```ts
  const fundraiser = await fetchFundraiser(rpc, fundraiserAddress);
  // fundraiser.data is strongly typed, u64 -> bigint, pubkeys -> Address strings
  ```
* **Instruction Builders & PDA Resolution:**
  - `getContributeInstruction(...)`: Requires all account addresses explicitly.
  - `getContributeInstructionAsync(...)`: Automatically derives PDAs and fills known program IDs if all required seed inputs are present in the instruction arguments.
* **Transaction Construction via `pipe()`:**
  ```ts
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayerSigner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );
  ```

---

### 5. Rule of Account Resolution: What Codama Can & Cannot Derive
* **Auto-Derivable (Optional in Async Builder):**
  - PDAs whose seeds depend only on **constants** or **other accounts passed into the same instruction** (e.g. `contributorAccount` derived from `[b"contributor", fundraiser, contributor]`).
  - Known static program IDs (System Program, SPL Token Program, Associated Token Program).
* **Non-Derivable (Required in Builder):**
  - Accounts whose seeds depend on **data stored inside on-chain accounts** (e.g. `fundraiser.maker` or `fundraiser.mint_to_raise`), because Codama does not perform arbitrary asynchronous RPC fetches during local instruction composition.

---

### 6. Giving Custom/Pinocchio Programs an IDL (3 Approaches)
1. **Shank (`#[derive(ShankAccount, ShankInstruction)]`)**:
   - Annotations in native Rust; `shank idl` outputs Anchor-format JSON with `origin: "shank"`.
2. **Codama Macros (`#[derive(CodamaAccount, CodamaInstructions)]`)**:
   - Rust macros from Anza that emit Codama JSON directly via `build.rs`.
3. **Hand-Written AST Nodes (`rootNode(programNode({ ... }))`)**:
   - Programmatic TypeScript definition of instruction nodes, PDA links, and struct data layouts.

---

### 7. Publishing IDLs On-Chain
* **Program Metadata Program (`ProgM6JC..nk7S`)**:
  - Stores the canonical Codama IDL in a program-derived account `[program, "idl"]`.
  - Enables Solana Explorer and wallets to decode and label transaction instructions automatically (`contribute(amount: 1000000)` instead of opaque hex bytes).
* **CLI Command:**
  ```bash
  npx @solana-program/program-metadata@latest write idl <PROGRAM_ID> ./idl.json
  ```
