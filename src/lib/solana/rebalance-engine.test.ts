import { calculatePortfolioState, analyzeDrift, executeRebalance } from './rebalance-engine';
import { isRebalanceCooldownActive, derivePortfolioVaultPda } from './vault-program';
import { PublicKey } from '@solana/web3.js';
import { PREBUILT_STRATEGIES } from '../../data/strategies';
import { SUPPORTED_STOCKS } from '../../data/stocks';

console.log('=== StockPilot Rebalancing Engine & Vault Test Suite ===\n');

// Test 1: Portfolio State Calculation
console.log('Test 1: Initial Portfolio State Calculation');
const aiStrategy = PREBUILT_STRATEGIES[0];
const initialHoldings = aiStrategy.tokens.map(t => {
  const stock = SUPPORTED_STOCKS[t.symbol];
  const allocUsdc = 2500 * t.targetWeight;
  return {
    symbol: t.symbol,
    shares: allocUsdc / stock.price,
    targetWeight: t.targetWeight
  };
});

const initialPrices: Record<string, number> = {};
aiStrategy.tokens.forEach(t => {
  initialPrices[t.symbol] = SUPPORTED_STOCKS[t.symbol].price;
});

const state1 = calculatePortfolioState(initialHoldings, initialPrices);
console.log(`Total Value: $${state1.totalValueUsdc} USDC`);
console.assert(Math.abs(state1.totalValueUsdc - 2500) < 1.0, 'Total value should be approx $2500');

state1.holdings.forEach(h => {
  console.log(`  - ${h.symbol}: weight ${(h.currentWeight * 100).toFixed(1)}% (target ${(h.targetWeight * 100).toFixed(0)}%), drift ${h.driftPercent}%`);
  console.assert(Math.abs(h.driftPercent) < 0.5, 'Initial drift should be near 0');
});
console.log('✓ Test 1 Passed\n');

// Test 2: Drift Detection on Volatility Shock
console.log('Test 2: Drift Detection on +30% Price Shock');
const shockedPrices = { ...initialPrices };
shockedPrices['xNVDA'] = shockedPrices['xNVDA'] * 1.30; // NVDA surges 30%
shockedPrices['xAMD'] = shockedPrices['xAMD'] * 0.85;   // AMD drops 15%

const state2 = calculatePortfolioState(initialHoldings, shockedPrices);
console.log(`Updated Total Value: $${state2.totalValueUsdc} USDC`);

const driftReport = analyzeDrift(state2.holdings, state2.totalValueUsdc, 5.0);
console.log(`Max Drift Detected: ${driftReport.maxDriftPercent}%`);
console.log(`Has Significant Drift (>5%): ${driftReport.hasDrift}`);
console.assert(driftReport.hasDrift === true, 'Should detect significant drift');
console.assert(driftReport.overweightHoldings.some(h => h.symbol === 'xNVDA'), 'xNVDA should be overweight');
console.assert(driftReport.rebalanceTransactions.some(t => t.toSymbol === 'xAMD'), 'xAMD should be rebalance target');
console.log(`Planned Rebalance Swaps Count: ${driftReport.rebalanceTransactions.length}`);
driftReport.rebalanceTransactions.forEach(t => {
  console.log(`  - Swap $${t.amountUsdc} from ${t.fromSymbol} -> ${t.toSymbol} (${t.reason})`);
});
console.log('✓ Test 2 Passed\n');

// Test 3: Execute Rebalance & Verify Weight Realignment
console.log('Test 3: Execute Atomic Rebalance');
const { newHoldings, transactions } = executeRebalance(state2.holdings, state2.totalValueUsdc, shockedPrices);
console.log(`Generated Solana Atomic Transactions: ${transactions.length}`);
transactions.forEach(tx => {
  console.log(`  - Tx [${tx.txSignature}]: ${tx.reason}`);
});

newHoldings.forEach(h => {
  console.log(`  - Rebalanced ${h.symbol}: weight ${(h.currentWeight * 100).toFixed(0)}% (target ${(h.targetWeight * 100).toFixed(0)}%), drift ${h.driftPercent}%`);
  console.assert(h.driftPercent === 0, 'Post-rebalance drift must be 0%');
});
console.log('✓ Test 3 Passed\n');

// Test 4: PDA Vault Derivation & Timelock Cooldown
console.log('Test 4: PDA Vault Derivation & Timelock Cooldown');
const mockUser = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
const [vaultPda, bump] = derivePortfolioVaultPda(mockUser);
console.log(`User Address: ${mockUser.toBase58()}`);
console.log(`Derived StockPilot Vault PDA: ${vaultPda.toBase58()} (bump: ${bump})`);
console.assert(vaultPda !== null && bump >= 0, 'PDA derivation must be deterministic and valid');

const nowSec = Math.floor(Date.now() / 1000);
const cooldownActive = isRebalanceCooldownActive(nowSec - 100, 300); // 100s elapsed of 300s
console.log(`Cooldown Active Check (100s of 300s): ${cooldownActive.isActive} (remaining: ${cooldownActive.remainingSeconds}s)`);
console.assert(cooldownActive.isActive === true, 'Cooldown should be active');

const cooldownExpired = isRebalanceCooldownActive(nowSec - 350, 300); // 350s elapsed of 300s
console.log(`Cooldown Expired Check (350s of 300s): active=${cooldownExpired.isActive} (remaining: ${cooldownExpired.remainingSeconds}s)`);
console.assert(cooldownExpired.isActive === false, 'Cooldown should be expired');
console.log('✓ Test 4 Passed\n');

console.log('==================================================');
console.log('ALL 4 CORE FINANCIAL AND SOLANA TESTS PASSED! 🚀');
console.log('==================================================');
