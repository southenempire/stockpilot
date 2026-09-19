import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculatePortfolioState, analyzeDrift, executeRebalance } from '../src/lib/solana/rebalance-engine';
import { PortfolioHolding } from '../src/types/stock';

describe('StockPilot Autonomous Rebalance Engine', () => {
  const mockHoldingsInput = [
    { symbol: 'xNVDA', shares: 2.5, targetWeight: 0.35 },
    { symbol: 'xTSM', shares: 1.5, targetWeight: 0.25 },
    { symbol: 'xAMD', shares: 1.3, targetWeight: 0.20 },
    { symbol: 'xMSFT', shares: 0.5, targetWeight: 0.20 },
  ];

  const mockPrices = {
    xNVDA: 130.00,
    xTSM: 170.00,
    xAMD: 150.00,
    xMSFT: 430.00,
  };

  it('calculates portfolio total value and individual weights correctly', () => {
    const { totalValueUsdc, holdings } = calculatePortfolioState(mockHoldingsInput, mockPrices);

    // NVDA: 2.5 * 130 = 325
    // TSM: 1.5 * 170 = 255
    // AMD: 1.3 * 150 = 195
    // MSFT: 0.5 * 430 = 215
    // Total = 325 + 255 + 195 + 215 = 990
    assert.strictEqual(totalValueUsdc, 990);
    assert.strictEqual(holdings.length, 4);

    const nvda = holdings.find((h) => h.symbol === 'xNVDA')!;
    assert.strictEqual(nvda.currentValue, 325);
    // Weight = 325 / 990 = 0.3283
    assert.ok(Math.abs(nvda.currentWeight - 0.3283) < 0.01);
  });

  it('detects portfolio drift when deviation breaches tolerance threshold', () => {
    // Force a high drift on NVDA
    const driftedHoldings: PortfolioHolding[] = [
      {
        symbol: 'xNVDA',
        name: 'NVIDIA',
        shares: 5.0,
        currentPrice: 150.00, // 750 USDC (75% of 1000)
        currentValue: 750.00,
        targetWeight: 0.35, // Target 35% -> +40% drift
        currentWeight: 0.75,
        driftPercent: 40.0,
        change24h: 10.0,
      },
      {
        symbol: 'xTSM',
        name: 'TSMC',
        shares: 1.47,
        currentPrice: 170.00, // 250 USDC (25% of 1000)
        currentValue: 250.00,
        targetWeight: 0.65, // Target 65% -> -40% drift
        currentWeight: 0.25,
        driftPercent: -40.0,
        change24h: -2.0,
      },
    ];

    const report = analyzeDrift(driftedHoldings, 1000, 5.0);

    assert.strictEqual(report.hasDrift, true);
    assert.strictEqual(report.overweightHoldings.length, 1);
    assert.strictEqual(report.underweightHoldings.length, 1);
    assert.strictEqual(report.overweightHoldings[0].symbol, 'xNVDA');
    assert.strictEqual(report.underweightHoldings[0].symbol, 'xTSM');
    assert.ok(report.rebalanceTransactions.length > 0);
  });

  it('generates zero rebalance transactions when drift is within tolerance', () => {
    const balancedHoldings: PortfolioHolding[] = [
      {
        symbol: 'xNVDA',
        name: 'NVIDIA',
        shares: 3.5,
        currentPrice: 100.00,
        currentValue: 350.00,
        targetWeight: 0.35,
        currentWeight: 0.35,
        driftPercent: 0.0,
        change24h: 0.0,
      },
      {
        symbol: 'xTSM',
        name: 'TSMC',
        shares: 6.5,
        currentPrice: 100.00,
        currentValue: 650.00,
        targetWeight: 0.65,
        currentWeight: 0.65,
        driftPercent: 0.0,
        change24h: 0.0,
      },
    ];

    const report = analyzeDrift(balancedHoldings, 1000, 5.0);
    assert.strictEqual(report.hasDrift, false);
    assert.strictEqual(report.rebalanceTransactions.length, 0);
  });

  it('executes atomic rebalance and restores target weights exactly', () => {
    const unbalancedHoldings: PortfolioHolding[] = [
      {
        symbol: 'xNVDA',
        name: 'NVIDIA',
        shares: 5.0,
        currentPrice: 100.00, // 500
        currentValue: 500.00,
        targetWeight: 0.50,
        currentWeight: 0.50,
        driftPercent: 0,
        change24h: 0,
      },
      {
        symbol: 'xTSM',
        name: 'TSMC',
        shares: 5.0,
        currentPrice: 100.00, // 500
        currentValue: 500.00,
        targetWeight: 0.50,
        currentWeight: 0.50,
        driftPercent: 0,
        change24h: 0,
      },
    ];

    // Price shock: NVDA doubles to 200, TSM stays at 100 -> total 1500 (NVDA 1000, TSM 500)
    const newPrices = { xNVDA: 200.00, xTSM: 100.00 };
    const { totalValueUsdc, holdings } = calculatePortfolioState(unbalancedHoldings, newPrices);
    assert.strictEqual(totalValueUsdc, 1500);

    const { newHoldings, transactions } = executeRebalance(holdings, totalValueUsdc, newPrices);

    assert.ok(transactions.length > 0);
    // Target value for each is 750 (50% of 1500)
    const newNvda = newHoldings.find((h) => h.symbol === 'xNVDA')!;
    const newTsm = newHoldings.find((h) => h.symbol === 'xTSM')!;

    assert.strictEqual(newNvda.currentValue, 750);
    assert.strictEqual(newTsm.currentValue, 750);
    assert.strictEqual(newNvda.shares, 3.75); // 750 / 200 = 3.75 shares
    assert.strictEqual(newTsm.shares, 7.5);   // 750 / 100 = 7.5 shares
    assert.strictEqual(newNvda.driftPercent, 0);
    assert.strictEqual(newTsm.driftPercent, 0);
  });
});
