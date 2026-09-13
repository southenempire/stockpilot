import { BasketStrategy } from '@/types/stock';

export const PREBUILT_STRATEGIES: BasketStrategy[] = [
  {
    id: 'ai-compute-chips',
    name: 'AI Compute & Silicon Index',
    tagline: 'Hardware foundation of the generative AI revolution',
    description: 'Autonomous basket weighting leading-edge semiconductor designers and foundries powering LLM training clusters worldwide.',
    riskTier: 'Aggressive',
    icon: 'Cpu',
    expectedAnnualReturn: '+38.4% (Simulated)',
    rebalanceFrequency: 'Daily Autonomous Drift Check',
    tags: ['Semis', 'GenAI', 'Hyperscalers', 'High Alpha'],
    tokens: [
      { symbol: 'xNVDA', targetWeight: 0.35 },
      { symbol: 'xTSM', targetWeight: 0.25 },
      { symbol: 'xAMD', targetWeight: 0.20 },
      { symbol: 'xMSFT', targetWeight: 0.20 }
    ]
  },
  {
    id: 'magnificent-seven',
    name: 'The Magnificent 7 Alpha',
    tagline: 'The 7 titans that drive 60% of the US market gains',
    description: 'Equally and momentum-weighted basket of Apple, Microsoft, Nvidia, Amazon, Alphabet, Meta, and Tesla.',
    riskTier: 'Balanced',
    icon: 'Crown',
    expectedAnnualReturn: '+26.2% (Simulated)',
    rebalanceFrequency: 'Weekly Autonomous Rebalance',
    tags: ['Megacap', 'Core Growth', 'Market Leaders'],
    tokens: [
      { symbol: 'xNVDA', targetWeight: 0.20 },
      { symbol: 'xMSFT', targetWeight: 0.20 },
      { symbol: 'xAAPL', targetWeight: 0.20 },
      { symbol: 'xAMZN', targetWeight: 0.15 },
      { symbol: 'xGOOGL', targetWeight: 0.15 },
      { symbol: 'xTSLA', targetWeight: 0.10 }
    ]
  },
  {
    id: 'dividend-cashflow',
    name: 'Dividend & Cashflow Fortress',
    tagline: 'Defensive compound interest with low volatility',
    description: 'Blue-chip dividend aristocrats with fortress balance sheets designed for capital preservation and steady compounding.',
    riskTier: 'Conservative',
    icon: 'ShieldCheck',
    expectedAnnualReturn: '+14.5% (Simulated)',
    rebalanceFrequency: 'Monthly Target Rebalance',
    tags: ['Low Beta', 'Dividends', 'Defensive', 'Recession Hedge'],
    tokens: [
      { symbol: 'xJNJ', targetWeight: 0.30 },
      { symbol: 'xPG', targetWeight: 0.30 },
      { symbol: 'xAAPL', targetWeight: 0.20 },
      { symbol: 'xMSFT', targetWeight: 0.20 }
    ]
  },
  {
    id: 'crypto-tech-beta',
    name: 'Cyberpunk & High-Beta Tech',
    tagline: 'Maximum volatility and exposure to the crypto-equity nexus',
    description: 'High momentum assets combining crypto market upside (Coinbase) with disruptive technology pioneers (Tesla, Nvidia).',
    riskTier: 'Aggressive',
    icon: 'Zap',
    expectedAnnualReturn: '+44.0% (Simulated)',
    rebalanceFrequency: 'Dynamic 5% Drift Trigger',
    tags: ['Crypto Stocks', 'Momentum', 'High Beta', '24/7 Trading'],
    tokens: [
      { symbol: 'xCOIN', targetWeight: 0.35 },
      { symbol: 'xTSLA', targetWeight: 0.35 },
      { symbol: 'xNVDA', targetWeight: 0.30 }
    ]
  }
];
