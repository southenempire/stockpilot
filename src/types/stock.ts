export interface Stock {
  symbol: string;
  name: string;
  category: 'Tech & AI' | 'Semiconductors' | 'Megacap' | 'Consumer & Dividend' | 'High Beta';
  price: number;
  change24h: number;
  marketCap: string;
  peRatio: number;
  iconBg: string;
  description: string;
}

export interface BasketToken {
  symbol: string;
  targetWeight: number; // e.g. 0.35 for 35%
}

export interface BasketStrategy {
  id: string;
  name: string;
  tagline: string;
  description: string;
  riskTier: 'Conservative' | 'Balanced' | 'Aggressive';
  icon: string;
  expectedAnnualReturn: string;
  tokens: BasketToken[];
  tags: string[];
  rebalanceFrequency: string;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  currentValue: number;
  targetWeight: number;   // 0 - 1
  currentWeight: number;  // 0 - 1
  driftPercent: number;   // e.g. +8.2% or -5.1%
  change24h: number;
}

export interface RebalanceTx {
  id: string;
  timestamp: number;
  fromAsset: string;
  toAsset: string;
  amountUsdc: number;
  txSignature: string;
  reason: string;
}

export interface PortfolioState {
  strategyId: string;
  strategyName: string;
  totalValueUsdc: number;
  vaultCashReserveUsdc: number;
  activePositionsValueUsdc: number;
  initialInvestmentUsdc: number;
  unallocatedUsdc: number;
  pnlUsdc: number;
  pnlPercent: number;
  lastRebalancedTimestamp: number;
  rebalanceCooldownSeconds: number;
  autopilotEnabled: boolean;
  driftThresholdPercent: number; // e.g. 5%
  holdings: PortfolioHolding[];
  history: RebalanceTx[];
}
