import { BasketToken, PortfolioHolding, RebalanceTx } from '@/types/stock';
import { SUPPORTED_STOCKS } from '@/data/stocks';

export interface DriftReport {
  hasDrift: boolean;
  maxDriftPercent: number;
  overweightHoldings: PortfolioHolding[];
  underweightHoldings: PortfolioHolding[];
  rebalanceTransactions: {
    fromSymbol: string;
    toSymbol: string;
    amountUsdc: number;
    reason: string;
  }[];
}

/**
 * Calculates current weights, portfolio totals, and drift percentages.
 */
export function calculatePortfolioState(
  holdings: { symbol: string; shares: number; targetWeight: number }[],
  livePrices: Record<string, number>
): {
  totalValueUsdc: number;
  holdings: PortfolioHolding[];
} {
  let totalValueUsdc = 0;

  // First pass: compute current values
  const intermediate = holdings.map((h) => {
    const stock = SUPPORTED_STOCKS[h.symbol];
    const price = livePrices[h.symbol] ?? stock?.price ?? 100;
    const value = h.shares * price;
    totalValueUsdc += value;
    return {
      symbol: h.symbol,
      name: stock?.name ?? h.symbol,
      shares: h.shares,
      currentPrice: price,
      currentValue: value,
      targetWeight: h.targetWeight,
      change24h: stock?.change24h ?? 0
    };
  });

  // Second pass: compute weights and drift
  const computedHoldings: PortfolioHolding[] = intermediate.map((item) => {
    const currentWeight = totalValueUsdc > 0 ? item.currentValue / totalValueUsdc : 0;
    const driftPercent = (currentWeight - item.targetWeight) * 100;

    return {
      ...item,
      currentWeight,
      driftPercent: Number(driftPercent.toFixed(2))
    };
  });

  return {
    totalValueUsdc: Number(totalValueUsdc.toFixed(2)),
    holdings: computedHoldings
  };
}

/**
 * Analyzes portfolio drift against threshold and generates atomic rebalancing plan.
 */
export function analyzeDrift(
  holdings: PortfolioHolding[],
  totalValueUsdc: number,
  thresholdPercent = 5.0
): DriftReport {
  const overweightHoldings: PortfolioHolding[] = [];
  const underweightHoldings: PortfolioHolding[] = [];
  let maxDriftPercent = 0;

  for (const h of holdings) {
    const absDrift = Math.abs(h.driftPercent);
    if (absDrift > maxDriftPercent) {
      maxDriftPercent = absDrift;
    }
    if (h.driftPercent > thresholdPercent) {
      overweightHoldings.push(h);
    } else if (h.driftPercent < -thresholdPercent) {
      underweightHoldings.push(h);
    }
  }

  const hasDrift = maxDriftPercent >= thresholdPercent;
  const rebalanceTransactions: DriftReport['rebalanceTransactions'] = [];

  if (hasDrift) {
    const sellers = holdings.filter((h) => h.currentWeight > h.targetWeight);
    const buyers = holdings.filter((h) => h.currentWeight < h.targetWeight);

    for (const over of sellers) {
      let excessUsdc = (over.currentWeight - over.targetWeight) * totalValueUsdc;
      for (const under of buyers) {
        const deficitUsdc = (under.targetWeight - under.currentWeight) * totalValueUsdc;
        const tradeAmount = Math.min(excessUsdc, deficitUsdc);

        if (tradeAmount > 0.5) {
          rebalanceTransactions.push({
            fromSymbol: over.symbol,
            toSymbol: under.symbol,
            amountUsdc: Number(tradeAmount.toFixed(2)),
            reason: `Rebalance drift: ${over.symbol} (+${over.driftPercent}%) trimmed into ${under.symbol} (${under.driftPercent}%)`
          });
          excessUsdc -= tradeAmount;
        }
      }
    }
  }

  return {
    hasDrift,
    maxDriftPercent: Number(maxDriftPercent.toFixed(2)),
    overweightHoldings,
    underweightHoldings,
    rebalanceTransactions
  };
}

/**
 * Executes a simulated atomic rebalance returning updated shares and simulated Solana tx.
 */
export function executeRebalance(
  currentHoldings: PortfolioHolding[],
  totalValueUsdc: number,
  livePrices: Record<string, number>
): {
  newHoldings: PortfolioHolding[];
  transactions: RebalanceTx[];
} {
  const timestamp = Date.now();
  const txs: RebalanceTx[] = [];

  const newHoldings = currentHoldings.map((h) => {
    const price = livePrices[h.symbol] ?? h.currentPrice;
    const targetUsdc = totalValueUsdc * h.targetWeight;
    const newShares = Number((targetUsdc / price).toFixed(4));
    const deltaShares = newShares - h.shares;

    if (Math.abs(deltaShares * price) > 1.0) {
      // Create random simulated Solana base58 signature
      const randomSig = Array.from({ length: 64 }, () =>
        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
      ).join('').slice(0, 44);

      txs.push({
        id: `tx_${Date.now()}_${h.symbol}`,
        timestamp,
        fromAsset: deltaShares < 0 ? h.symbol : 'USDC',
        toAsset: deltaShares > 0 ? h.symbol : 'USDC',
        amountUsdc: Number(Math.abs(deltaShares * price).toFixed(2)),
        txSignature: `${randomSig}...`,
        reason: `Atomic swap aligned ${h.symbol} to target weight ${(h.targetWeight * 100).toFixed(0)}%`
      });
    }

    return {
      ...h,
      shares: newShares,
      currentPrice: price,
      currentValue: Number(targetUsdc.toFixed(2)),
      currentWeight: h.targetWeight,
      driftPercent: 0
    };
  });

  return {
    newHoldings,
    transactions: txs
  };
}
