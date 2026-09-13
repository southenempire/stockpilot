# 🚀 StockPilot — Autonomous 24/7 AI Stock Portfolios on Solana

> **Submitted to the Solana Foundation Stocklana Hackathon (September 2026)**  
> **Track / Wedge:** **Investing (Index Baskets & Robo Portfolios) + Consumer Mobile-First UX**

---

## 💡 The Problem & Thesis

TradFi brokerages (Robinhood, Fidelity, Schwab) and robo-advisors (Wealthfront, Betterment) suffer from legacy financial rail bottlenecks:
1. **Markets close at 4:00 PM** and remain shut all weekend.
2. **Rebalancing takes 1 to 3 days to settle** and hits users with exorbitant advisory management fees.
3. **Rigid ETF products** cannot be customized to an investor's real-time personal conviction.

With tokenized stocks trading natively on Solana, **investing no longer needs to wait for Wall Street**. 

**StockPilot** is an autonomous robo-advisor dApp that turns Solana into a 24/7 autonomous wealth manager:
* **1-Tap Thematic Stock Baskets** (e.g. *AI Compute & Chips*, *Magnificent 7*, *Dividend Fortress*, *Cyberpunk High Beta*).
* **"Prompt-to-Portfolio" AI Copilot:** Convert any natural language investment thesis into mathematically weighted on-chain allocations in seconds.
* **Autonomous 24/7 Drift Detection & 1-Tap Rebalance Engine:** Monitors asset weight drift and executes atomic multi-token rebalancing in 400ms for < $0.0008.
* **Mobile-First Consumer Onboarding & Viral Flex Cards:** Frictionless demo pilot mode ($10,000 preloaded test USDC) and 1-tap shareable performance cards for X and TikTok.

---

## ⚙️ Architecture & On-Chain Primitives

```
┌─────────────────────────────────────────────────────────────┐
│                   StockPilot Mobile dApp                    │
│   (Next.js 16 + Tailwind CSS + Framer Motion + Confetti)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       [Select / Prompt]             [Deposit / Rebalance]
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     AI Strategy Engine      │ │   Solana Vault & Rebalance  │
│  (Dynamic weight allocation │ │ (PDA Custody + Clock Sysvar │
│   + Covariance synthesis)   │ │  Timelock Cooldown + Swaps) │
└─────────────────────────────┘ └──────────────┬──────────────┘
                                               │
                                               ▼
                                ┌─────────────────────────────┐
                                │ Tokenized Stock SPL Mints   │
                                │ (xNVDA, xAAPL, xTSLA, USDC) │
                                └─────────────────────────────┘
```

### Key Solana Primitives Leveraged:
1. **PDA Vault Custody:** Modeled on program-derived address vaults (`seeds = [b"stockpilot_vault", user_pubkey]`) so only authorized rebalancing programs or user instructions can touch assets.
2. **Clock Sysvar Timelock Cooldown:** Enforces time-lock verification (`now >= last_rebalanced + cooldown`) using `Clock::get()?.unix_timestamp` to prevent high-frequency slippage churn.
3. **Token-2022 & Atomic Multi-Token Routing:** Compatible with modern Token-2022 RWA equity mints and sub-cent atomic batch swaps.

---

## 🎯 How to Demo for Hackathon Judges

1. **Open the App:** Launch the app in your browser (desktop or mobile).
2. **Demo Pilot Mode:** By default, Demo Pilot Mode is preloaded with **$10,000 USDC** (or connect Phantom / Solflare on Solana Devnet).
3. **Select or Generate a Basket:**
   * Pick one of the 4 pre-built baskets, OR
   * Click **"AI Basket Creator" / "Prompt-to-Portfolio"** and type: *"Aggressive semiconductor and AI hardware basket"* to see the AI generate target weights.
4. **Deposit & Allocate:** Enter \$250 USDC and click **"Deposit & Allocate Instantly"**.
5. **Test Drift Detection (Interactive Simulator):**
   * Use the **+15%** or **-10%** test buttons next to any stock (e.g. `xNVDA`) to simulate price volatility.
   * Watch the Drift Alert banner immediately flag the percentage drift!
6. **Execute 1-Tap Rebalance:**
   * Click **"1-Tap Rebalance"** to preview the planned atomic swaps.
   * Hit **"Confirm 1-Tap Rebalance"** $\rightarrow$ see the celebratory confetti, on-chain transaction signature, and portfolio weights realign back to target!
7. **Export Viral Flex Card:**
   * Click **"Export Viral Flex Card"** to see the 9:16 mobile story card formatted for instant sharing.

---

## 🛠️ Local Development & Setup

### Prerequisites
- Node.js >= 18
- npm

### Install and Run
```bash
# Clone the repository
git clone https://github.com/southenempire/stockpilot.git
cd stockpilot

# Install dependencies
npm install

# Run the development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build
```bash
npm run build
npm run start
```

---

## 🏆 Hackathon Details
- **Event:** Solana Foundation Stocklana Hackathon
- **Deadline:** September 18, 2026
- **Built by:** `1southen03`
