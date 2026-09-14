<div align="center">

# StockPilot

### Autonomous 24/7 AI Stock Robo-Advisor on Solana

[![Solana](https://img.shields.io/badge/Solana-Mainnet_%26_Devnet-9945FF?style=flat-square&logo=solana&logoColor=white)](https://solscan.io/account/CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-v0.30-3B82F6?style=flat-square)](https://www.anchor-lang.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Community-24A1DE?style=flat-square&logo=telegram&logoColor=white)](https://t.me/+ir8klWwop_5mZjg0)
[![X](https://img.shields.io/badge/X-@StockPilotSOL-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/StockPilotSOL)

[Terminal](https://stockpilotsol.xyz) / [Deployment Mirror](https://stockpilot-two-psi.vercel.app) / [Telegram](https://t.me/+ir8klWwop_5mZjg0) / [Twitter](https://x.com/StockPilotSOL)

</div>

---

## Executive Summary

StockPilot is an autonomous, non-custodial stock robo-advisor running natively on Solana. 

Traditional wealth managers and retail brokerages are restricted by legacy banking infrastructure: markets close at 4:00 PM, settlements take multiple days, index rebalances suffer from manual execution drag, and investors incur 0.25% to 1.50% in recurring management fees while surrendering asset custody to centralized custodians.

StockPilot leverages tokenized US equities (xNVDA, xTSM, xAMD, xMSFT) and high-frequency Solana primitives to deliver:
* Continuous 24/7/365 Liquidity: Trade and rebalance tokenized equity baskets with zero market pauses or holiday closures.
* Sub-Second Atomic Rebalancing: Automated drift detection triggers rebalances executed in <400ms slots via Jupiter DEX for ~$0.0008 in gas.
* 100% Non-Custodial Anchor Vaults: User assets reside in isolated Program-Derived Address (PDA) vaults where only the user's cryptographic key can authorize withdrawals.
* Consumer-Grade Web2 and Web3 Onboarding: Instant embedded wallet creation via Privy (Google and Email) alongside native Phantom and Solflare support.
* Simulated Sandbox: Interactive preloaded test environment to model portfolio volatility and observe automated rebalancing prior to deploying capital.

---

## Benchmark: Legacy Brokerages vs. StockPilot

| Feature | TradFi Brokerages (Robinhood / Schwab) | Legacy Robo-Advisors (Wealthfront / Betterment) | StockPilot On-Chain |
| :--- | :--- | :--- | :--- |
| Trading Hours | 9:30 AM – 4:00 PM EST (Closed Weekends) | Batch end-of-day execution | 24/7/365 Continuous Real-Time |
| Asset Custody | Centralized broker street name | Third-party clearing custodian | 100% Non-Custodial Anchor PDA Vault |
| Settlement Time | T+1 / T+2 days | T+2 days | < 400ms Sub-Second Atomic Slots |
| Annual Management Drag | Hidden spread + margin fees | 0.25% – 1.50% AUM annual fee | 0.00% Annual AUM Drag |
| Network Fee per Trade | $0 commissions (PFOF slippage) | Integrated into custodian drag | <$0.001 (Solana Network Gas) |
| Withdrawal Flexibility | 3–5 business day wire/ACH delays | Multi-day liquidation windows | Instant On-Chain Withdraw to Wallet |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          StockPilot Client Interface                         │
│             (Next.js 16 App Router · Tailwind CSS · Framer Motion)          │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
             [Email / Social Auth]            [Wallet Signatures]
                       │                               │
                       ▼                               ▼
        ┌─────────────────────────────┐ ┌─────────────────────────────┐
        │       Privy Enclave         │ │   Solana Wallet Adapter     │
        │   (Instant Embedded EOA)    │ │    (Phantom / Solflare)     │
        └──────────────┬──────────────┘ └──────────────┬──────────────┘
                       │                               │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │            StockPilot Anchor Smart Contract                 │
        │      Program ID: CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK       │
        ├─────────────────────────────────────────────────────────────┤
        │ • PDA User Vault: seeds = [b"stockpilot_vault", authority]  │
        │ • On-Chain 0.15% Protocol Fee Deduction (15 bps to Treasury)│
        │ • On-Chain State & Timelock Cooldown Coordinator            │
        │ • Owner Authorization Constraints (authority == vault.owner)│
        │ • Token Account Ownership & Mint Verification Constraints   │
        └──────────────┬───────────────────────────────┬──────────────┘
                       │                               │
               [Atomic Swaps]                  [RPC & State]
                       │                               │
                       ▼                               ▼
        ┌─────────────────────────────┐ ┌─────────────────────────────┐
        │     Jupiter DEX Routing     │ │     Helius RPC Network      │
        │  (Client-Side Best Route)   │ │ (High-Throughput Node APIs) │
        └─────────────────────────────┘ └─────────────────────────────┘
```

---

## Smart Contract Primitives

The core protocol is implemented in Rust using the Anchor framework on Solana.

* Program ID: [`CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK`](https://solscan.io/account/CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK?cluster=devnet)
* Contract Authority: `FVyGEtqSKPHkiKgeSa8imWW5gzWNN5A5txwJgs7zFQhb`
* Protocol Treasury: `2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo`

### Verified On-Chain Transactions

| Lifecycle Action | Network | Transaction Signature / Solscan Link | Status |
| :--- | :--- | :--- | :--- |
| **Initialize Vault PDA** | Solana Devnet | [`4Vff2RFdsqCKDgMatUvLHa9coVtMdRhDz6iC4iKbKKXZr4XSCGtiFQJNzPSbvFL48m5YrP21faGHi6krdi3Jaip`](https://solscan.io/tx/4Vff2RFdsqCKDgMatUvLHa9coVtMdRhDz6iC4iKbKKXZr4XSCGtiFQJNzPSbvFL48m5YrP21faGHi6krdi3Jaip?cluster=devnet) | Confirmed |
| **Deposit + 0.15% Fee Split** | Solana Devnet | [`2vFVU6FPTMJsPuKQpJi8C5WoXzN6fXNNLcitoXCd8YaHfm8n2CqxCrveisMiSZVgXx8JojafoPCUYB17qejdgVQB`](https://solscan.io/tx/2vFVU6FPTMJsPuKQpJi8C5WoXzN6fXNNLcitoXCd8YaHfm8n2CqxCrveisMiSZVgXx8JojafoPCUYB17qejdgVQB?cluster=devnet) | Confirmed |
| **Autonomous Rebalance Execution** | Solana Devnet | [`5ZrygkZ259W3QrbmYHrfkf8JPXZWJ6rrV4NnP1MJ95PSjhP1CU8y9Gm9h2WZAFb1dsBg31A8pdvRA5FPakvMACR9`](https://solscan.io/tx/5ZrygkZ259W3QrbmYHrfkf8JPXZWJ6rrV4NnP1MJ95PSjhP1CU8y9Gm9h2WZAFb1dsBg31A8pdvRA5FPakvMACR9?cluster=devnet) | Confirmed |
| **Vault Withdrawal to Owner** | Solana Devnet | [`48TzJeinNWPZdb2B5ALG5fYTv6MfYq9cgLWxWnHd7xVrvjtoAWt4A2x3Ypd2tCxo4PsyHtLY4nvEhTqfifiasLuU`](https://solscan.io/tx/48TzJeinNWPZdb2B5ALG5fYTv6MfYq9cgLWxWnHd7xVrvjtoAWt4A2x3Ypd2tCxo4PsyHtLY4nvEhTqfifiasLuU?cluster=devnet) | Confirmed |

### Invariants and Security Boundaries
1. Isolated PDA Vaults: Vault addresses are deterministically derived via `Pubkey::find_program_address(&[b"stockpilot_vault", authority.key().as_ref()], program_id)`. Only the matching user authority can sign withdrawal and rebalance instructions (`constraint = authority.key() == vault.owner`).
2. Token Account Validation: `Deposit` and `Withdraw` instructions strictly validate that token accounts match the vault PDA ownership (`vault_token_account.owner == vault.key()`) and expected token mints.
3. On-Chain State & Timelock Coordinator: The contract acts as the on-chain state and cooldown coordinator, enforcing that `now >= vault.last_rebalance_ts + cooldown_seconds` (5-minute cooldown) before updating state counters, while multi-token swap execution is routed atomically via Jupiter on the client.
4. On-Chain Protocol Fee Deduction & Treasury Enforcement: The deposit instruction calculates a 0.15% protocol fee (15 basis points) and transfers it directly to the protocol treasury token account via CPI, with strict ownership verification ensuring `treasury_token_account.owner == PROTOCOL_TREASURY_PUBKEY` to prevent fee redirection. The remaining 99.85% net amount is secured in the user's isolated PDA vault.

---

## Security and Privacy Design

Built with reference to the [Kaggle Whitepaper on Agent Security and Evaluation](https://www.kaggle.com/whitepaper-vibe-coding-agent-security-and-evaluation):

* Zero Custody of Private Keys: The dApp never requests, handles, or stores user seed phrases or private keys. Signatures are executed inside isolated wallet enclaves.
* Pseudonymous Identifier Hashing: Backend user activity is indexed via one-way salted HMAC-SHA256 hashes. Raw wallet addresses and personal identifiers are never stored in plaintext.
* Transaction Signature Verification: Activity logging validates incoming Solana transaction signature formats to prevent unverified client submissions.
* Secret Isolation: All API keys and sensitive parameters are strictly isolated in encrypted production environment variables; zero credentials exist within source control.

---

## Tech Stack

* Frontend: Next.js 16 (App Router, React Server Components), TypeScript, Tailwind CSS
* Smart Contracts: Rust, Anchor Framework 0.30, Solana Tool suite
* Wallets & Onboarding: Privy Embedded Wallets (Email / Google), Solana Wallet Adapter (Phantom, Solflare)
* DEX & Execution: Jupiter v6 Swap API (Atomic Equities Routing)
* Infrastructure: Helius High-Throughput Solana RPCs, Vercel Edge Network
* Database Layer: Node.js Native SQLite (`node:sqlite`) with HMAC-SHA256 privacy layer

---

## Quickstart & Local Development

### Prerequisites
* Node.js >= 18.x
* pnpm or npm
* Rust & Solana CLI (optional, for contract development)

### 1. Clone & Install
```bash
git clone https://github.com/southenempire/stockpilot.git
cd stockpilot
npm install
```

### 2. Configure Environment
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_helius_api_key
NEXT_PUBLIC_TREASURY_WALLET_ADDRESS=2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_secret
NEXT_PUBLIC_STOCKPILOT_PROGRAM_ID=CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Official Links

* Web Application: [https://stockpilotsol.xyz](https://stockpilotsol.xyz)
* Deployment Mirror: [https://stockpilot-two-psi.vercel.app](https://stockpilot-two-psi.vercel.app)
* Telegram Community: [https://t.me/+ir8klWwop_5mZjg0](https://t.me/+ir8klWwop_5mZjg0)
* Twitter / X: [@StockPilotSOL](https://x.com/StockPilotSOL)
* Source Code: [github.com/southenempire/stockpilot](https://github.com/southenempire/stockpilot)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
