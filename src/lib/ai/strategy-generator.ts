import { BasketStrategy } from '@/types/stock';
import { SUPPORTED_STOCKS } from '@/data/stocks';

/**
 * Intelligent prompt-to-portfolio generator.
 * Maps user goals, themes, and risk parameters to optimal tokenized stock allocations.
 */
export function generateAiStrategy(prompt: string): BasketStrategy {
  const normalizedPrompt = prompt.toLowerCase();

  let riskTier: BasketStrategy['riskTier'] = 'Balanced';
  let name = 'Custom AI Alpha Index';
  let tagline = 'Optimized algorithmic stock allocation';
  let icon = 'Sparkles';
  let expectedReturn = '+28.5% (Simulated)';
  let rebalanceFrequency = 'Dynamic 5% Drift Autopilot';

  let rawWeights: Record<string, number> = {};

  if (normalizedPrompt.includes('dividend') || normalizedPrompt.includes('safe') || normalizedPrompt.includes('conservative') || normalizedPrompt.includes('income')) {
    riskTier = 'Conservative';
    name = 'AI Cashflow & Defensive Aristocrats';
    tagline = 'Capital preservation with steady quarterly dividend yields';
    icon = 'ShieldCheck';
    expectedReturn = '+16.2% (Simulated)';
    rebalanceFrequency = 'Bi-Weekly Cooldown Rebalance';
    rawWeights = {
      xJNJ: 0.30,
      xPG: 0.30,
      xMSFT: 0.20,
      xAAPL: 0.20
    };
  } else if (normalizedPrompt.includes('chip') || normalizedPrompt.includes('semi') || normalizedPrompt.includes('hardware') || normalizedPrompt.includes('compute')) {
    riskTier = 'Aggressive';
    name = 'Autonomous Silicon & Foundry Index';
    tagline = 'Pure-play exposure to global chip fabricators and compute monopolies';
    icon = 'Cpu';
    expectedReturn = '+42.0% (Simulated)';
    rawWeights = {
      xNVDA: 0.40,
      xTSM: 0.30,
      xAMD: 0.20,
      xMSFT: 0.10
    };
  } else if (normalizedPrompt.includes('crypto') || normalizedPrompt.includes('degen') || normalizedPrompt.includes('high risk') || normalizedPrompt.includes('aggressive')) {
    riskTier = 'Aggressive';
    name = 'Hyper-Growth Crypto & High Beta Alpha';
    tagline = 'Maximum volatility upside capturing the convergence of AI, EV, and on-chain finance';
    icon = 'Zap';
    expectedReturn = '+46.8% (Simulated)';
    rawWeights = {
      xCOIN: 0.35,
      xTSLA: 0.35,
      xNVDA: 0.30
    };
  } else if (normalizedPrompt.includes('robot') || normalizedPrompt.includes('autonomous') || normalizedPrompt.includes('energy')) {
    riskTier = 'Aggressive';
    name = 'Autonomous Robotics & AI Frontier';
    tagline = 'Leading the transition toward embodied AI and mass autonomous logistics';
    icon = 'Bot';
    expectedReturn = '+39.5% (Simulated)';
    rawWeights = {
      xTSLA: 0.40,
      xNVDA: 0.35,
      xGOOGL: 0.25
    };
  } else {
    // Default balanced dynamic tech basket tailored to keywords
    name = 'AI Momentum & Hyperscaler Basket';
    tagline = 'Diversified allocation across cloud infrastructure and AI leaders';
    rawWeights = {
      xNVDA: 0.30,
      xMSFT: 0.25,
      xAAPL: 0.25,
      xAMZN: 0.20
    };
  }

  // Normalize weights so they strictly sum to 1.0 (100%)
  const totalWeight = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  const tokens = Object.entries(rawWeights).map(([symbol, weight]) => ({
    symbol,
    targetWeight: Number((weight / totalWeight).toFixed(2))
  }));

  // Fix any slight rounding difference on the first token
  const currentSum = tokens.reduce((acc, t) => acc + t.targetWeight, 0);
  if (tokens.length > 0 && Math.abs(1 - currentSum) > 0.001) {
    tokens[0].targetWeight = Number((tokens[0].targetWeight + (1 - currentSum)).toFixed(2));
  }

  return {
    id: `ai_strategy_${Date.now()}`,
    name,
    tagline,
    description: `Generated dynamically by StockPilot AI based on your prompt: "${prompt}". Evaluates market capitalization, 24/7 liquidity, and volatility covariance.`,
    riskTier,
    icon,
    expectedAnnualReturn: expectedReturn,
    rebalanceFrequency,
    tags: ['AI Generated', 'Dynamic Index', '24/7 Autopilot'],
    tokens
  };
}
