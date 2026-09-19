'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { PREBUILT_STRATEGIES } from '@/data/strategies';
import { SUPPORTED_STOCKS } from '@/data/stocks';
import { BasketStrategy, PortfolioHolding, RebalanceTx, Stock } from '@/types/stock';
import { calculatePortfolioState, analyzeDrift } from '@/lib/solana/rebalance-engine';
import { generateAiStrategy } from '@/lib/ai/strategy-generator';
import { derivePortfolioVaultPda } from '@/lib/solana/vault-program';
import HoldingRow from '@/components/HoldingRow';
import StrategyCard from '@/components/StrategyCard';
import RebalanceModal from '@/components/RebalanceModal';
import BuyModal from '@/components/BuyModal';
import SocialFlexCardModal from '@/components/SocialFlexCardModal';
import PromptModal from '@/components/PromptModal';
import TourModal from '@/components/TourModal';
import WithdrawModal from '@/components/WithdrawModal';
import DepositModal from '@/components/DepositModal';
import DeployModal from '@/components/DeployModal';
import DevnetFaucetModal from '@/components/DevnetFaucetModal';
import LandingView from '@/components/landing/LandingView';
import ThemeToggle from '@/components/ThemeToggle';
import StockPilotLogo from '@/components/StockPilotLogo';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faCompass,
  faArrowsRotate,
  faArrowTrendUp,
  faArrowTrendDown,
  faShareNodes,
  faPlus,
  faLayerGroup,
  faRobot,
  faShieldHalved,
  faMobileScreen,
  faLock,
  faWandMagicSparkles,
  faArrowRight,
  faCircleCheck,
  faCircleExclamation,
  faSliders,
  faCheck,
  faChevronLeft,
  faChartLine,
  faFire,
  faWallet,
  faEnvelope,
  faRightFromBracket,
  faBars,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter, faGithub, faTelegram } from '@fortawesome/free-brands-svg-icons';
import { usePrivy } from '@privy-io/react-auth';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// Synthetic historical chart data points for timeframes
const TIMEFRAME_DATA: Record<string, number[]> = {
  '1D': [10000, 10040, 10080, 10030, 10120, 10180, 10250, 10300, 10280, 10400, 10450, 10500],
  '1W': [9800, 9900, 9850, 10100, 10050, 10200, 10350, 10400, 10600, 10750, 10850, 11000],
  '1M': [9200, 9400, 9300, 9600, 9850, 10000, 10200, 10150, 10600, 10900, 11200, 11500],
  '1Y': [7500, 7800, 8200, 8100, 8600, 9100, 9500, 9900, 10200, 10700, 11100, 11500],
  ALL: [5000, 5600, 6200, 6900, 7500, 8100, 8800, 9400, 10000, 10600, 11100, 11500],
};

export default function StockPilotApp() {
  // Theme state: dark (obsidian & cyan) vs light (clean slate)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isLight = theme === 'light';

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Solana Wallet Adapter Hooks
  const { setVisible: openWalletModal } = useWalletModal();
  const { publicKey: adapterPublicKey, connected: adapterConnected, disconnect } = useWallet();
  const { connection } = useConnection();
  const { login: privyLogin, logout: privyLogout, authenticated: privyAuthenticated, user: privyUser } = usePrivy();

  // Find Privy embedded Solana wallet if user logs in with Email/Social
  const privySolanaAddress = useMemo(() => {
    if (!privyUser) return null;
    if (privyUser.wallet && (privyUser.wallet as any).chainType === 'solana') {
      return privyUser.wallet.address;
    }
    const solAccount = privyUser.linkedAccounts?.find(
      (acc: any) => acc.type === 'wallet' && acc.chainType === 'solana'
    );
    if (solAccount && 'address' in solAccount) {
      return (solAccount as any).address;
    }
    return privyUser.wallet?.address || null;
  }, [privyUser]);

  const privyPublicKey = useMemo(() => {
    if (!privySolanaAddress) return null;
    try {
      return new PublicKey(privySolanaAddress);
    } catch {
      return null;
    }
  }, [privySolanaAddress]);

  // Unified active wallet & connection status (supports both Phantom/Solflare and Privy Email Login!)
  const publicKey = adapterPublicKey || privyPublicKey;
  const connected = adapterConnected || (privyAuthenticated && !!privyPublicKey);

  // Master view state: website presentation vs direct mobile app view
  const [viewMode, setViewMode] = useState<'website' | 'app'>('website');

  // Mobile App Navigation tabs
  const [activeTab, setActiveTab] = useState<'portfolio' | 'baskets' | 'ai' | 'vault'>('portfolio');

  // App & Wallet state: Solana Devnet
  const [vaultCashReserveUsdc, setVaultCashReserveUsdc] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<BasketStrategy>(PREBUILT_STRATEGIES[0]);
  const [driftTolerance, setDriftTolerance] = useState(5.0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1M');
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  // Real On-Chain Balances (Solana Devnet)
  const [realSolBalance, setRealSolBalance] = useState<number | null>(null);
  const [realUsdcBalance, setRealUsdcBalance] = useState<number | null>(null);
  const [realVaultBalance, setRealVaultBalance] = useState<number | null>(null);
  const [solPriceUsd, setSolPriceUsd] = useState<number>(138.50);
  const [isLoadingRealBalances, setIsLoadingRealBalances] = useState<boolean>(false);

  // Derived user Vault PDA address on Solana Devnet
  const userVaultPda = useMemo(() => {
    if (!publicKey) return null;
    try {
      const [pda] = derivePortfolioVaultPda(publicKey);
      return pda.toBase58();
    } catch {
      return null;
    }
  }, [publicKey]);

  // Dynamic campaign cycle phrase in hero
  const campaignPhrases = ['Cheaper.', 'Simpler.', 'Smarter.'];
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % campaignPhrases.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [campaignPhrases.length]);

  // Live Pyth Network Real-Time Oracle Feed & Faucet state
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [pythOracleActive, setPythOracleActive] = useState(true);
  const [pythLastTimestamp, setPythLastTimestamp] = useState(Date.now());

  // Price registry (Initialized with fallbacks and continuously refreshed via Pyth Hermes Oracle)
  const [livePrices, setLivePrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.values(SUPPORTED_STOCKS).forEach((s) => {
      initial[s.symbol] = s.price;
    });
    return initial;
  });

  // Polling Pyth Network real-time oracle prices every 10 seconds
  useEffect(() => {
    let isMounted = true;
    const fetchLivePythPrices = async () => {
      try {
        const res = await fetch('/api/pyth-prices');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.prices && isMounted) {
            const updated: Record<string, number> = {};
            Object.entries(data.prices).forEach(([sym, info]: [string, any]) => {
              if (info.price && typeof info.price === 'number') {
                updated[sym] = info.price;
              }
            });
            if (Object.keys(updated).length > 0) {
              setLivePrices((prev) => ({ ...prev, ...updated }));
              setPythLastTimestamp(data.timestamp || Date.now());
              setPythOracleActive(true);
            }
          }
        }
      } catch (err) {
        console.warn('Pyth Hermes polling note:', err);
      }
    };

    fetchLivePythPrices();
    const interval = setInterval(fetchLivePythPrices, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Holdings state (Starts at 0 in vault; demo wallet starts with $10,000 uninvested cash)
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    return PREBUILT_STRATEGIES[0].tokens.map((t) => {
      const stock = SUPPORTED_STOCKS[t.symbol];
      return {
        symbol: t.symbol,
        name: stock.name,
        shares: 0,
        currentPrice: stock.price,
        currentValue: 0,
        targetWeight: t.targetWeight,
        currentWeight: t.targetWeight,
        driftPercent: 0,
        change24h: stock.change24h,
      };
    });
  });

  const [autopilotEnabled, setAutopilotEnabled] = useState(true);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('500');
  const [lastRebalanced, setLastRebalanced] = useState(Date.now() - 3600000);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSandboxDrawerOpen, setIsSandboxDrawerOpen] = useState(true);

  // Modals
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [buyTargetBasket, setBuyTargetBasket] = useState<BasketStrategy | null>(null);
  const [buyTargetStock, setBuyTargetStock] = useState<Stock | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Launch app directly
  const handleLaunchApp = () => {
    setViewMode('app');
  };
  const [marketExploreView, setMarketExploreView] = useState<'baskets' | 'stocks'>('baskets');
  const [customThesis, setCustomThesis] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // On-chain log
  const [txHistory, setTxHistory] = useState<RebalanceTx[]>([
    {
      id: 'tx_init',
      timestamp: Date.now() - 7200000,
      fromAsset: 'USDC',
      toAsset: 'AI Compute Index',
      amountUsdc: 1000,
      txSignature: '4h9Km7uQ8rZ2xL9PnTv8W2k1Y5mC3xJ8vQ2L4aB7n9K',
      reason: 'Vault initialized with AI Compute & Silicon Index on Solana Devnet',
    },
  ]);

  // Recalculate portfolio state for active equity positions (Layer 2)
  const { totalValueUsdc: activePositionsValue, holdings: computedHoldings } = calculatePortfolioState(
    holdings,
    livePrices
  );

  // Total Vault Net Asset Value = Layer 1 Vault Cash Reserve + Layer 2 Active Equity Positions
  const totalValueUsdc = vaultCashReserveUsdc + activePositionsValue;

  // Analyze drift for active basket
  const driftAnalysis = analyzeDrift(computedHoldings, activePositionsValue, driftTolerance);

  // Real-time on-chain balance fetcher from Solana Devnet
  const fetchRealBalances = React.useCallback(async () => {
    if (!connected || !publicKey) {
      setRealSolBalance(null);
      setRealUsdcBalance(null);
      return;
    }

    setIsLoadingRealBalances(true);
    try {
      // 1. Fetch live real on-chain balances via backend proxy (avoids browser RPC 403 blocks)
      const balRes = await fetch(`/api/wallet-balances?address=${publicKey.toBase58()}`);
      if (balRes.ok) {
        const data = await balRes.json();
        if (data.success) {
          setRealSolBalance(data.sol);
          setRealUsdcBalance(data.usdc);
          setRealVaultBalance(data.vaultSol);
        }
      } else {
        // Fallback direct RPC connection
        const lamports = await connection.getBalance(publicKey);
        setRealSolBalance(lamports / LAMPORTS_PER_SOL);
      }

      // 2. Fetch live SOL/USD price
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (res.ok) {
          const data = await res.json();
          if (data?.solana?.usd) {
            setSolPriceUsd(data.solana.usd);
          }
        }
      } catch {
        // ignore CoinGecko rate limits
      }
    } catch (err) {
      console.warn('Solana balance query error:', err);
      if (realSolBalance === null) setRealSolBalance(0);
      if (realUsdcBalance === null) setRealUsdcBalance(0);
      if (realVaultBalance === null) setRealVaultBalance(0);
    } finally {
      setIsLoadingRealBalances(false);
    }
  }, [connected, publicKey, connection, realSolBalance, realUsdcBalance, realVaultBalance]);

  useEffect(() => {
    fetchRealBalances();
  }, [fetchRealBalances]);

  // Real live net worth calculations on Solana Devnet (Liquid Wallet + Non-Custodial Vault PDA)
  const liveSolVal = realSolBalance !== null ? realSolBalance * solPriceUsd : 0;
  const liveUsdcVal = realUsdcBalance !== null ? realUsdcBalance : 0;
  const liveVaultVal = realVaultBalance !== null ? realVaultBalance * solPriceUsd : 0;
  const realTotalNetWorth = liveSolVal + liveUsdcVal + liveVaultVal;

  // Active Portfolio Net Asset Value based on connected wallet & vault
  const activeNetAssetValue = connected ? (realTotalNetWorth + totalValueUsdc) : 0;

  // PnL metrics
  const pnlPercent = 14.82; // Benchmark index return
  const pnlUsdc = totalValueUsdc > 0 ? totalValueUsdc * (pnlPercent / 100) : 0;

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Synchronize user profile & history with backend database using HMAC-SHA256 hashed identity
  useEffect(() => {
    if (!connected || !publicKey) return;

    const syncUserBackend = async () => {
      try {
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawIdentifier: publicKey.toBase58(),
            authProvider: privySolanaAddress ? 'privy' : 'solana_wallet',
            displayName: privyUser?.email?.address || '',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.recentActivity && data.recentActivity.length > 0) {
            const backendTxs = data.recentActivity.map((a: any) => ({
              id: a.id,
              timestamp: a.created_at,
              fromAsset: a.asset,
              toAsset: a.activity_type.toUpperCase(),
              amountUsdc: a.amount,
              txSignature: a.tx_signature,
              reason: a.reason,
            }));
            setTxHistory((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const newTxs = backendTxs.filter((t: any) => !existingIds.has(t.id));
              return [...newTxs, ...prev];
            });
          }
        }
      } catch (err) {
        console.warn('Backend user sync error:', err);
      }
    };

    syncUserBackend();
  }, [connected, publicKey, privySolanaAddress, privyUser]);

  // Handle strategy switch
  const handleSelectStrategy = (strat: BasketStrategy) => {
    setSelectedStrategy(strat);
    const updated = strat.tokens.map((t) => {
      const stock = SUPPORTED_STOCKS[t.symbol];
      const targetVal = activePositionsValue * t.targetWeight;
      const currentShares = targetVal / (livePrices[t.symbol] || stock.price);
      return {
        symbol: t.symbol,
        name: stock.name,
        shares: currentShares,
        currentPrice: livePrices[t.symbol] || stock.price,
        currentValue: targetVal,
        targetWeight: t.targetWeight,
        currentWeight: t.targetWeight,
        driftPercent: 0,
        change24h: stock.change24h,
      };
    });
    setHoldings(updated);
  };

  // Price adjustment simulator for market shocks
  const applyShock = (symbol: string, multiplier: number) => {
    setLivePrices((prev) => {
      const current = prev[symbol] || SUPPORTED_STOCKS[symbol].price;
      return {
        ...prev,
        [symbol]: Number((current * multiplier).toFixed(2)),
      };
    });
  };

  const resetPrices = () => {
    const initial: Record<string, number> = {};
    Object.values(SUPPORTED_STOCKS).forEach((s) => {
      initial[s.symbol] = s.price;
    });
    setLivePrices(initial);
  };

  // Vault Rebalance execution (Layer 2 Active Basket)
  const handleConfirmRebalance = (txSig?: string) => {
    if (activePositionsValue <= 0) return;

    const updated = computedHoldings.map((h) => {
      const targetVal = activePositionsValue * h.targetWeight;
      const newShares = targetVal / h.currentPrice;
      return {
        ...h,
        shares: newShares,
        currentValue: targetVal,
        currentWeight: h.targetWeight,
        driftPercent: 0,
      };
    });

    setHoldings(updated);
    setLastRebalanced(Date.now());
    setCooldownSeconds(300);

    const sig =
      txSig ||
      Array.from({ length: 44 }, () =>
        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[
          Math.floor(Math.random() * 58)
        ]
      ).join('');

    setTxHistory((prev) => [
      {
        id: `tx_${Date.now()}`,
        timestamp: Date.now(),
        fromAsset: 'Drifted Basket',
        toAsset: 'Target Weights',
        amountUsdc: driftAnalysis.rebalanceTransactions.reduce(
          (acc, t) => acc + t.amountUsdc,
          0
        ),
        txSignature: sig,
        reason: `Rebalanced ${selectedStrategy.name} on Solana Devnet`,
      },
      ...prev,
    ]);

    // Record rebalance to backend database
    if (publicKey) {
      fetch('/api/user/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdentifier: publicKey.toBase58(),
          activityType: 'rebalance',
          asset: 'BASKET',
          amount: driftAnalysis.rebalanceTransactions.reduce((acc, t) => acc + t.amountUsdc, 0),
          txSignature: sig,
          reason: `Rebalanced ${selectedStrategy.name} on Solana Devnet`,
        }),
      }).catch(console.warn);
    }
  };

  // 1-Tap Deploy from Vault Cash Reserve (Layer 1) into Strategy Basket (Layer 2)
  const handleDeployCashReserve = (
    amountToDeploy: number,
    targetStrategy: BasketStrategy = selectedStrategy
  ) => {
    if (amountToDeploy <= 0 || amountToDeploy > vaultCashReserveUsdc) return;

    setVaultCashReserveUsdc((c) => Math.max(0, c - amountToDeploy));
    setSelectedStrategy(targetStrategy);

    setHoldings((prev) => {
      return targetStrategy.tokens.map((t) => {
        const stock = SUPPORTED_STOCKS[t.symbol];
        const price = livePrices[t.symbol] || stock.price;
        const existing = prev.find((h) => h.symbol === t.symbol);
        const existingShares = existing ? existing.shares : 0;
        const alloc = amountToDeploy * t.targetWeight;
        const newShares = existingShares + alloc / price;
        return {
          symbol: t.symbol,
          name: stock.name,
          shares: newShares,
          currentPrice: price,
          currentValue: newShares * price,
          targetWeight: t.targetWeight,
          currentWeight: t.targetWeight,
          driftPercent: 0,
          change24h: stock.change24h,
        };
      });
    });

    const sig = Array.from({ length: 44 }, () =>
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[
        Math.floor(Math.random() * 58)
      ]
    ).join('');

    setTxHistory((prev) => [
      {
        id: `tx_deploy_${Date.now()}`,
        timestamp: Date.now(),
        fromAsset: '1️⃣ Vault Cash Reserve (USDC)',
        toAsset: `2️⃣ ${targetStrategy.name}`,
        amountUsdc: amountToDeploy,
        txSignature: sig,
        reason: `1-Tap Deployed $${amountToDeploy.toFixed(2)} from PDA Cash Reserve into ${targetStrategy.name}`,
      },
      ...prev,
    ]);

    setIsDeployModalOpen(false);
  };

  // Unwind active equity positions back into 0-risk Vault Cash Reserve (Layer 2 -> Layer 1)
  const handleUnwindToReserve = (amountToUnwind?: number) => {
    if (activePositionsValue <= 0) return;
    const unwindVal = amountToUnwind ? Math.min(amountToUnwind, activePositionsValue) : activePositionsValue;
    const remainRatio = Math.max(0, (activePositionsValue - unwindVal) / activePositionsValue);

    setHoldings((prev) =>
      prev.map((h) => ({
        ...h,
        shares: h.shares * remainRatio,
        currentValue: h.currentValue * remainRatio,
      }))
    );

    setVaultCashReserveUsdc((c) => c + unwindVal);

    const sig = Array.from({ length: 44 }, () =>
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[
        Math.floor(Math.random() * 58)
      ]
    ).join('');

    setTxHistory((prev) => [
      {
        id: `tx_unwind_${Date.now()}`,
        timestamp: Date.now(),
        fromAsset: `2️⃣ ${selectedStrategy.name}`,
        toAsset: '1️⃣ Vault Cash Reserve (USDC)',
        amountUsdc: unwindVal,
        txSignature: sig,
        reason: `De-risked $${unwindVal.toFixed(2)} of equities back into Vault Cash Reserve`,
      },
      ...prev,
    ]);
  };

  // Handle Deposit Success (from on-chain modal)
  const handleDepositSuccess = (
    amountUsdc: number,
    asset: 'USDC' | 'SOL',
    txSig: string,
    destination: 'reserve' | 'strategy' = 'reserve'
  ) => {

    if (destination === 'reserve') {
      setVaultCashReserveUsdc((c) => c + amountUsdc);
      setTxHistory((p) => [
        {
          id: `tx_dep_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: `${asset} (Wallet)`,
          toAsset: '1️⃣ Vault Cash Reserve (USDC)',
          amountUsdc,
          txSignature: txSig,
          reason: `Deposited $${amountUsdc.toFixed(2)} into 0-risk Vault Cash Reserve`,
        },
        ...p,
      ]);
    } else {
      const updated = selectedStrategy.tokens.map((t) => {
        const stock = SUPPORTED_STOCKS[t.symbol];
        const price = livePrices[t.symbol] || stock.price;
        const existing = holdings.find((h) => h.symbol === t.symbol);
        const existingShares = existing ? existing.shares : 0;
        const alloc = amountUsdc * t.targetWeight;
        const newShares = existingShares + alloc / price;
        return {
          symbol: t.symbol,
          name: stock.name,
          shares: newShares,
          currentPrice: price,
          currentValue: newShares * price,
          targetWeight: t.targetWeight,
          currentWeight: t.targetWeight,
          driftPercent: 0,
          change24h: stock.change24h,
        };
      });
      setHoldings(updated);
      setTxHistory((p) => [
        {
          id: `tx_dep_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: `${asset} (Wallet)`,
          toAsset: `2️⃣ ${selectedStrategy.name}`,
          amountUsdc,
          txSignature: txSig,
          reason: `Deposited & deployed $${amountUsdc.toFixed(2)} into ${selectedStrategy.name}`,
        },
        ...p,
      ]);
    }

    setIsDepositOpen(false);
    fetchRealBalances();

    // Record deposit to backend database
    if (publicKey) {
      fetch('/api/user/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdentifier: publicKey.toBase58(),
          activityType: 'deposit',
          asset,
          amount: amountUsdc,
          txSignature: txSig,
          reason: `Deposit ${asset} (${destination === 'reserve' ? 'Cash Reserve' : selectedStrategy.name}) on Solana`,
        }),
      }).catch(console.warn);
    }
  };

  // Handle Withdrawal Success (from on-chain modal)
  const handleWithdrawSuccess = (
    amountUsdc: number,
    asset: 'USDC' | 'SOL',
    txSig: string,
    source: 'reserve' | 'positions' = 'reserve'
  ) => {

    if (source === 'reserve') {
      setVaultCashReserveUsdc((c) => Math.max(0, c - amountUsdc));
      setTxHistory((prev) => [
        {
          id: `tx_wdr_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: '1️⃣ Vault Cash Reserve (USDC)',
          toAsset: `${asset} (Wallet)`,
          amountUsdc,
          txSignature: txSig,
          reason: `Withdrew $${amountUsdc.toFixed(2)} from Cash Reserve back to wallet`,
        },
        ...prev,
      ]);
    } else {
      setHoldings((prev) => {
        const currentVaultTotal = prev.reduce((sum, h) => sum + h.currentValue, 0);
        if (currentVaultTotal <= 0 || amountUsdc >= currentVaultTotal) {
          return prev.map((h) => ({
            ...h,
            shares: 0,
            currentValue: 0,
            currentWeight: 0,
          }));
        }
        const remainRatio = Math.max(0, (currentVaultTotal - amountUsdc) / currentVaultTotal);
        return prev.map((h) => ({
          ...h,
          shares: h.shares * remainRatio,
          currentValue: h.currentValue * remainRatio,
        }));
      });

      setTxHistory((prev) => [
        {
          id: `tx_wdr_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: `2️⃣ ${selectedStrategy.name}`,
          toAsset: `${asset} (Wallet)`,
          amountUsdc,
          txSignature: txSig,
          reason: `Liquidated $${amountUsdc.toFixed(2)} active positions to wallet`,
        },
        ...prev,
      ]);
    }

    setIsWithdrawOpen(false);
    fetchRealBalances();

    // Record withdrawal to backend database
    if (publicKey) {
      fetch('/api/user/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdentifier: publicKey.toBase58(),
          activityType: 'withdraw',
          asset,
          amount: amountUsdc,
          txSignature: txSig,
          reason: `Withdrew $${amountUsdc.toFixed(2)} to wallet`,
        }),
      }).catch(console.warn);
    }
  };

  // Handle Real Stock & Basket Purchases on Solana
  const handleBuySuccess = ({
    type,
    item,
    amountUsdc,
    paymentAsset,
    paymentAmount,
    txSignature,
  }: {
    type: 'basket' | 'stock';
    item: BasketStrategy | Stock;
    amountUsdc: number;
    paymentAsset: 'USDC' | 'SOL';
    paymentAmount: number;
    txSignature: string;
  }) => {
    if (type === 'stock') {
      const stock = item as Stock;
      const price = livePrices[stock.symbol] || stock.price;
      const newShares = amountUsdc / price;

      setHoldings((prev) => {
        const existing = prev.find((h) => h.symbol === stock.symbol);
        if (existing) {
          return prev.map((h) =>
            h.symbol === stock.symbol
              ? {
                  ...h,
                  shares: h.shares + newShares,
                  currentValue: (h.shares + newShares) * price,
                }
              : h
          );
        } else {
          return [
            ...prev,
            {
              symbol: stock.symbol,
              name: stock.name,
              shares: newShares,
              currentPrice: price,
              currentValue: amountUsdc,
              targetWeight: 0.25,
              currentWeight: 0.25,
              driftPercent: 0,
              change24h: stock.change24h,
            },
          ];
        }
      });

      setTxHistory((prev) => [
        {
          id: `tx_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: `${paymentAmount} ${paymentAsset}`,
          toAsset: stock.symbol,
          amountUsdc,
          txSignature,
          reason: `Purchased ${newShares.toFixed(3)} ${stock.symbol} on Solana`,
        },
        ...prev,
      ]);
    } else {
      const basket = item as BasketStrategy;
      setSelectedStrategy(basket);
      const updated = basket.tokens.map((t) => {
        const stock = SUPPORTED_STOCKS[t.symbol];
        const price = livePrices[t.symbol] || stock.price;
        const existing = holdings.find((h) => h.symbol === t.symbol);
        const existingShares = existing ? existing.shares : 0;
        const alloc = amountUsdc * t.targetWeight;
        const newShares = existingShares + alloc / price;
        return {
          symbol: t.symbol,
          name: stock.name,
          shares: newShares,
          currentPrice: price,
          currentValue: newShares * price,
          targetWeight: t.targetWeight,
          currentWeight: t.targetWeight,
          driftPercent: 0,
          change24h: stock.change24h,
        };
      });
      setHoldings(updated);

      setTxHistory((prev) => [
        {
          id: `tx_${Date.now()}`,
          timestamp: Date.now(),
          fromAsset: `${paymentAmount} ${paymentAsset}`,
          toAsset: basket.name,
          amountUsdc,
          txSignature,
          reason: `Invested $${amountUsdc.toFixed(2)} in ${basket.name} on Solana Devnet`,
        },
        ...prev,
      ]);
    }
  };

  // Natural Language AI Synthesis
  const handleSynthesizeThesis = (thesisText: string, openBuyModal = false) => {
    setIsSynthesizing(true);
    setTimeout(() => {
      const generated = generateAiStrategy(thesisText);
      setSelectedStrategy(generated);
      handleSelectStrategy(generated);
      setIsSynthesizing(false);
      if (openBuyModal) {
        setBuyTargetBasket(generated);
        setBuyTargetStock(null);
        setIsBuyModalOpen(true);
      } else {
        setActiveTab('portfolio');
      }
    }, 900);
  };

  // Sparkline points generator
  const currentChartPoints = TIMEFRAME_DATA[selectedTimeframe];
  const minVal = Math.min(...currentChartPoints);
  const maxVal = Math.max(...currentChartPoints);
  const chartHeight = 110;
  const chartWidth = 500;
  const pointsString = currentChartPoints
    .map((val, idx) => {
      const x = (idx / (currentChartPoints.length - 1)) * chartWidth;
      const y = chartHeight - ((val - minVal) / (maxVal - minVal || 1)) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  // Mobile App Content Component (with isInsideMockup)
  const renderMobileAppContent = (isInsideMockup = false) => {
    return (
    <div
      className={`w-full flex flex-col transition-colors relative overflow-hidden ${
        isInsideMockup ? 'h-[580px] max-h-[580px]' : 'h-full flex-1'
      } ${
        isLight
          ? 'bg-[#F8FAFC] text-slate-900 selection:bg-sky-500/20 selection:text-sky-800'
          : 'bg-[#06080F] text-slate-100 selection:bg-[#00D2FF]/20 selection:text-[#00D2FF]'
      }`}
    >
      {/* Mobile Top Bar - Fixed at top, never scrolls away */}
      <div
        className={`flex items-center justify-between border-b px-4 py-3 backdrop-blur-md shrink-0 z-30 transition-colors ${
          isLight ? 'bg-white/95 border-slate-200 shadow-sm' : 'bg-[#080D18]/95 border-[#1E293B]'
        }`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <StockPilotLogo size={24} showText={false} theme={theme} />
          <span className={`font-extrabold text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Stock<span className="text-[#00D2FF]">Pilot</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold shrink-0 flex items-center gap-1.5 bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            title="Active Network: Solana Devnet"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>● Solana Devnet</span>
          </div>

          <button
            onClick={() => setIsFaucetOpen(true)}
            className="rounded-lg border px-2 py-1 text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 bg-[#00D2FF]/10 border-[#00D2FF]/30 text-[#00D2FF] hover:bg-[#00D2FF]/20 transition cursor-pointer"
            title="Open Solana Devnet Faucet"
          >
            <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5" />
            <span>Faucet</span>
          </button>

          {connected && publicKey ? (
            <button
              onClick={() => disconnect()}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer shrink-0 border ${
                isLight
                  ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
              title="Connected (Click to Disconnect)"
            >
              <FontAwesomeIcon icon={faWallet} className="w-2.5 h-2.5 text-[#00D2FF]" />
              <span>{publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-3)}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-w-full p-4 space-y-4 pb-6 overscroll-contain">
        {/* TAB 1: PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div className="space-y-4">
            {/* Portfolio Value Card */}
            <div
              className={`rounded-2xl border p-5 relative overflow-hidden transition-all group ${
                isLight
                  ? 'bg-white border-slate-200 shadow-md shadow-slate-200/50'
                  : 'bg-gradient-to-b from-[#0E1524] via-[#0A101C] to-[#080D17] border-[#1E293B]'
              }`}
            >
              {/* Anime Styled Cyber Warrior Mascot at Right Side */}
              <div className="absolute right-0 top-0 bottom-0 w-36 sm:w-48 pointer-events-none overflow-hidden select-none z-0">
                <Image
                  src="/anime-warrior.jpg"
                  alt="Anime Pilot Warrior"
                  fill
                  sizes="(max-width: 640px) 144px, 192px"
                  className="object-cover object-top opacity-35 dark:opacity-50 transition-all duration-500 group-hover:scale-105 group-hover:opacity-65"
                />
                <div
                  className={`absolute inset-0 ${
                    isLight
                      ? 'bg-gradient-to-r from-white via-white/50 to-transparent'
                      : 'bg-gradient-to-r from-[#0E1524] via-[#0E1524]/60 to-transparent'
                  }`}
                />
                <div
                  className={`absolute inset-0 ${
                    isLight
                      ? 'bg-gradient-to-t from-white via-transparent to-transparent'
                      : 'bg-gradient-to-t from-[#080D17] via-transparent to-transparent'
                  }`}
                />
                <div className="absolute top-4 right-4 w-20 h-20 bg-[#00D2FF]/20 rounded-full blur-xl pointer-events-none" />
              </div>

              <div className="relative z-10">
                <div className="text-[11px] font-bold uppercase tracking-wider font-mono flex items-center justify-between">
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Portfolio Value (USDC)</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isLight
                        ? 'bg-sky-50 text-sky-700 border-sky-300'
                        : 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 font-bold'
                    }`}
                  >
                    [SOLANA DEVNET]
                  </span>
                </div>

                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <div
                      className={`font-mono text-3xl font-extrabold tracking-tight ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      $
                      {totalValueUsdc.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <span className="text-xs font-mono text-slate-500">Vault Net Worth</span>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-[10px] text-slate-400">Wallet USDC:</div>
                    <div className={`text-xs font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      ${(realUsdcBalance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>

                {/* Monthly Gain Pill or Zero State */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {totalValueUsdc > 0 ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                          pnlUsdc >= 0
                            ? isLight
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={pnlUsdc >= 0 ? faArrowTrendUp : faArrowTrendDown}
                          className="w-3 h-3"
                        />
                        <span>{pnlUsdc >= 0 ? `+$${pnlUsdc.toFixed(2)}` : `-$${Math.abs(pnlUsdc).toFixed(2)}`}</span>
                        <span>({pnlPercent >= 0 ? `+${pnlPercent}%` : `${pnlPercent}%`})</span>
                      </div>
                      <span className="text-[11px] text-slate-400">24h drift</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-[#00D2FF] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] animate-pulse" />
                      <span>Vault empty. Deposit USDC or SOL from Faucet to start.</span>
                    </div>
                  )}
                </div>

                {/* Sparkline & Timeframe pills */}
                <div className={`mt-4 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      Tokenized Equity Index
                    </span>
                    <div className="flex items-center gap-1">
                      {(['1D', '1W', '1M', '1Y', 'ALL'] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setSelectedTimeframe(tf)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                            selectedTimeframe === tf
                              ? isLight
                                ? 'bg-slate-900 text-white font-bold'
                                : 'bg-[#00D2FF] text-[#06080F] font-bold'
                              : isLight
                              ? 'text-slate-500 hover:text-slate-800'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Performance Curve */}
                  <div className="h-16 w-full relative">
                    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                      <polyline
                        fill="none"
                        stroke={isLight ? '#0284C7' : '#00D2FF'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pointsString}
                      />
                    </svg>
                  </div>
                </div>

                  {/* Quick Action Bar */}
                  <div className={`mt-4 pt-3 border-t grid grid-cols-4 gap-1.5 sm:gap-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                    <button
                      onClick={() => setIsDepositOpen(true)}
                      className={`flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[10px] sm:text-xs font-semibold transition cursor-pointer min-w-0 ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 rotate-45 text-emerald-400 shrink-0" />
                      <span className="truncate">Deposit</span>
                    </button>

                    <button
                      onClick={() => setIsWithdrawOpen(true)}
                      className={`flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[10px] sm:text-xs font-semibold transition cursor-pointer min-w-0 ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 -rotate-45 text-purple-400 shrink-0" />
                      <span className="truncate">Withdraw</span>
                    </button>

                    <button
                      onClick={() => setIsRebalanceModalOpen(true)}
                      className={`flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[10px] sm:text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm min-w-0 ${
                        driftAnalysis.hasDrift
                          ? isLight
                            ? 'bg-sky-600 text-white shadow-sky-600/20'
                            : 'bg-[#00D2FF] text-[#06080F] shadow-[#00D2FF]/20 animate-pulse'
                          : isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/10 hover:bg-white/15 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faArrowsRotate} className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">Rebalance</span>
                    </button>

                  </div>
                </div>
              </div>

                {/* 2-Layer Vault Architecture Breakdown (Layer 1 Cash Reserve vs Layer 2 Active Strategy) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  {/* Layer 1: Vault Cash Reserve */}
                  <div
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-colors ${
                      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                          <FontAwesomeIcon icon={faShieldHalved} className="w-3.5 h-3.5" />
                          <span>1️⃣ Vault Cash Reserve</span>
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                          0% Risk • PDA
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          ${vaultCashReserveUsdc.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">USDC</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-sans leading-tight">
                        Idle stable liquidity in private PDA. Deploy into equities with 1 tap.
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5 flex gap-2">
                      <button
                        onClick={() => setIsDeployModalOpen(true)}
                        disabled={vaultCashReserveUsdc <= 0}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          vaultCashReserveUsdc > 0
                            ? isLight
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm'
                              : 'bg-gradient-to-r from-amber-400 to-[#00D2FF] text-[#06080F] font-extrabold shadow-md shadow-amber-500/20 hover:brightness-110'
                            : isLight
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-white/5 text-slate-500'
                        }`}
                      >
                        <FontAwesomeIcon icon={faBolt} className="w-3 h-3" />
                        <span>1-Tap Deploy</span>
                      </button>
                      <button
                        onClick={() => setIsDepositOpen(true)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                          isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        + Add Cash
                      </button>
                    </div>
                  </div>

                  {/* Layer 2: Active Strategy Basket */}
                  <div
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-colors ${
                      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold flex items-center gap-1.5 text-[#00D2FF]">
                          <FontAwesomeIcon icon={faLayerGroup} className="w-3.5 h-3.5" />
                          <span>2️⃣ Active Basket</span>
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 truncate max-w-[120px]">
                          {selectedStrategy.name}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          ${activePositionsValue.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">USDC</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-sans leading-tight">
                        {computedHoldings.filter((h) => h.shares > 0).length > 0
                          ? `${computedHoldings.filter((h) => h.shares > 0).length} active tokenized US equities with autonomous Pyth drift rebalancing.`
                          : 'No active equity exposure yet. Deploy cash to activate.'}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5 flex gap-2">
                      <button
                        onClick={() => setIsRebalanceModalOpen(true)}
                        disabled={activePositionsValue <= 0}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          driftAnalysis.hasDrift
                            ? isLight
                              ? 'bg-sky-600 text-white'
                              : 'bg-[#00D2FF] text-[#06080F] animate-pulse'
                            : isLight
                            ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                            : 'bg-white/10 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <FontAwesomeIcon icon={faArrowsRotate} className="w-3 h-3" />
                        <span>{driftAnalysis.hasDrift ? 'Fix Drift' : 'Rebalance'}</span>
                      </button>
                      <button
                        onClick={() => handleUnwindToReserve()}
                        disabled={activePositionsValue <= 0}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                          isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                        title="Sell active equities back into 0-risk Vault Cash Reserve"
                      >
                        De-Risk
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visual Asset Allocation Bar */}
                <div
                  className={`rounded-2xl border p-4 space-y-2 transition-colors ${
                    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      Portfolio Allocation
                    </span>
                    <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {computedHoldings.length} Positions
                    </span>
                  </div>

                  {/* Segmented Distribution Bar */}
                  <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-0.5 bg-black/20 p-0.5">
                    {computedHoldings.map((h) => {
                      const colors = ['#00D2FF', '#38BDF8', '#818CF8', '#A78BFA', '#10B981'];
                      const stockIndex = Object.keys(SUPPORTED_STOCKS).indexOf(h.symbol) % colors.length;
                      return (
                        <div
                          key={h.symbol}
                          className="h-full rounded-sm transition-all duration-500"
                          style={{
                            width: `${h.currentWeight * 100}%`,
                            backgroundColor: colors[stockIndex],
                          }}
                          title={`${h.symbol}: ${(h.currentWeight * 100).toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono">
                    {computedHoldings.map((h) => (
                      <span
                        key={h.symbol}
                        className={`flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF]" />
                        <span className="font-semibold">{h.symbol}</span>
                        <span>{(h.currentWeight * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Holdings List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 text-xs">
                    <span className={`font-bold font-mono uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Holdings & Real-Time Drift
                    </span>
                    <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Tolerance: ±{driftTolerance}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {computedHoldings.map((h) => (
                      <HoldingRow
                        key={h.symbol}
                        holding={h}
                        driftTolerance={driftTolerance}
                        theme={theme}
                        compact={true}
                        onBuy={(holding) => {
                          const stock = SUPPORTED_STOCKS[holding.symbol];
                          if (stock) {
                            setBuyTargetBasket(null);
                            setBuyTargetStock(stock);
                            setIsBuyModalOpen(true);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TRADE & BASKETS */}
        {activeTab === 'baskets' && (
          <div className="space-y-4">
            <div className="px-1 flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Buy & Trade Equities
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  1-tap algorithmic thematic baskets or individual US stocks on Solana
                </p>
              </div>
            </div>

            {/* Segmented Filter: Thematic Baskets vs Single Stocks */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-black/20 border border-white/5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMarketExploreView('baskets')}
                className={`py-1.5 rounded-lg transition font-mono cursor-pointer ${
                  marketExploreView === 'baskets'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'bg-[#00D2FF] text-[#06080F] font-bold shadow-md shadow-[#00D2FF]/20'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Thematic Baskets ({PREBUILT_STRATEGIES.length})
              </button>
              <button
                type="button"
                onClick={() => setMarketExploreView('stocks')}
                className={`py-1.5 rounded-lg transition font-mono cursor-pointer ${
                  marketExploreView === 'stocks'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'bg-[#00D2FF] text-[#06080F] font-bold shadow-md shadow-[#00D2FF]/20'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Single Stocks ({Object.keys(SUPPORTED_STOCKS).length})
              </button>
            </div>

            {marketExploreView === 'baskets' ? (
              /* THEMATIC BASKETS LIST */
              <div className="space-y-3">
                {PREBUILT_STRATEGIES.map((strat) => (
                  <StrategyCard
                    key={strat.id}
                    strategy={strat}
                    isSelected={selectedStrategy.id === strat.id}
                    onSelect={(s) => {
                      handleSelectStrategy(s);
                      setActiveTab('portfolio');
                    }}
                    onBuy={(s) => {
                      setBuyTargetStock(null);
                      setBuyTargetBasket(s);
                      setIsBuyModalOpen(true);
                    }}
                    theme={theme}
                  />
                ))}
              </div>
            ) : (
              /* SINGLE STOCKS LIST */
              <div className="space-y-2.5">
                {Object.values(SUPPORTED_STOCKS).map((stock) => {
                  const currentPrice = livePrices[stock.symbol] || stock.price;
                  const isPositive = stock.change24h >= 0;
                  return (
                    <div
                      key={stock.symbol}
                      className={`rounded-2xl border p-3.5 transition-all flex items-center justify-between ${
                        isLight
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                          : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl font-mono font-bold text-white text-xs flex items-center justify-center shadow-md shrink-0"
                          style={{ backgroundColor: stock.iconBg || '#00D2FF' }}
                        >
                          {stock.symbol.replace('x', '')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold text-xs font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {stock.symbol}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-300'
                            }`}>
                              {stock.category}
                            </span>
                          </div>
                          <div className={`text-[11px] truncate max-w-[130px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {stock.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cap: {stock.marketCap} · P/E: {stock.peRatio}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            ${currentPrice.toFixed(2)}
                          </div>
                          <div className={`text-[10px] font-mono font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPositive ? `+${stock.change24h}%` : `${stock.change24h}%`}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setBuyTargetBasket(null);
                            setBuyTargetStock(stock);
                            setIsBuyModalOpen(true);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md flex items-center gap-1 ${
                            isLight
                              ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                              : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                          }`}
                        >
                          <span>Buy</span>
                          <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI BUILDER */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="px-1">
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                AI Strategy Copilot
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Describe your investment thesis in natural language
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 space-y-4 transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
              }`}
            >
              <div>
                <label className={`block text-xs font-semibold mb-2 font-mono ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Custom Investment Thesis:
                </label>
                <textarea
                  value={customThesis}
                  onChange={(e) => setCustomThesis(e.target.value)}
                  placeholder="E.g., High-beta autonomous robotics with semiconductor upside and a 15% defensive dividend cushion..."
                  rows={3}
                  className={`w-full rounded-xl border p-3 text-xs focus:outline-none transition ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white'
                      : 'bg-[#06080F] border-[#1E293B] text-white placeholder-slate-500 focus:border-[#00D2FF]'
                  }`}
                />
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Quick inspiration:
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {[
                    'Autonomous AI Compute & Silicon Infrastructure',
                    'High Dividend Titans with Low Volatility Hedge',
                    'Magnificent 7 Tech Dominance Index',
                  ].map((thesis) => (
                    <button
                      key={thesis}
                      onClick={() => setCustomThesis(thesis)}
                      className={`text-left rounded-lg border px-3 py-1.5 transition cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          : 'bg-[#101828] border-[#1E293B] text-slate-300 hover:bg-[#162338]'
                      }`}
                    >
                      {thesis}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSynthesizeThesis(customThesis, false)}
                  disabled={!customThesis.trim() || isSynthesizing}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer border ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                      : 'bg-white/10 border-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {isSynthesizing ? 'Synthesizing...' : 'Generate & Review'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSynthesizeThesis(customThesis, true)}
                  disabled={!customThesis.trim() || isSynthesizing}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                    isLight
                      ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                      : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                  }`}
                >
                  <FontAwesomeIcon icon={faBolt} className="w-3 h-3" />
                  <span>{isSynthesizing ? 'Synthesizing...' : 'Generate & Buy Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VAULT */}
        {activeTab === 'vault' && (
          <div className="space-y-3">
            <div className="px-1">
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Solana Vault & On-Chain Audit
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Non-custodial PDA security and cooldown enforcement
              </p>
            </div>

            {/* Connected User Vault PDA Status */}
            {connected && userVaultPda ? (
              <div
                className={`rounded-2xl border p-4 space-y-3 font-mono transition-colors ${
                  isLight ? 'bg-sky-50/60 border-sky-200 shadow-sm' : 'bg-[#00D2FF]/5 border-[#00D2FF]/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#00D2FF] flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faShieldHalved} className="w-3.5 h-3.5" />
                    Your Non-Custodial Vault
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold uppercase">
                    On-Chain Verified
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Vault PDA Address:</span>
                    <a
                      href={`https://solscan.io/account/${userVaultPda}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00D2FF] hover:underline font-semibold"
                    >
                      View on Solscan ↗
                    </a>
                  </div>
                  <div className={`p-2 rounded-lg text-[11px] break-all select-all font-mono ${
                    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-black/40 border border-white/5 text-slate-200'
                  }`}>
                    {userVaultPda}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50 dark:border-white/5">
                  <div>
                    <div className="text-[10px] text-slate-400">Vault Balance:</div>
                    <div className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {realVaultBalance !== null ? `${realVaultBalance.toFixed(4)} SOL` : '0.0000 SOL'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">USD Equivalent:</div>
                    <div className="text-sm font-bold text-emerald-400">
                      ${liveVaultVal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed bg-emerald-500/5 border border-emerald-500/20 p-2 rounded-lg">
                  🔒 Funds in this vault are strictly controlled by your wallet's programmatic PDA derivation. No third party can withdraw or reallocate without your cryptographic signature.
                </div>
              </div>
            ) : null}

            {/* Deterministic 2-Layer Vault Architecture Module */}
            <div
              className={`rounded-2xl border p-4 space-y-3 font-mono transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#00D2FF] flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faShieldHalved} className="w-3.5 h-3.5" />
                  2-Layer Non-Custodial Architecture
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-semibold uppercase">
                  Institutional Primitive
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Layer 1 Box */}
                <div
                  className={`p-3 rounded-xl border space-y-1.5 ${
                    isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 text-[11px]">1️⃣ Vault Cash Reserve</span>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      0% Risk
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans leading-tight">
                    Idle USDC stored deterministically in user PDA. Instant 1-tap deployment or withdrawal anytime.
                  </div>
                  <div className="text-[11px] font-bold text-white pt-1">
                    Reserve Balance: ${vaultCashReserveUsdc.toFixed(2)} USDC
                  </div>
                </div>

                {/* Layer 2 Box */}
                <div
                  className={`p-3 rounded-xl border space-y-1.5 ${
                    isLight ? 'bg-sky-50/50 border-sky-200' : 'bg-sky-500/5 border-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#00D2FF] text-[11px]">2️⃣ Active Strategy Baskets</span>
                    <span className="text-[9px] font-bold text-sky-400 bg-sky-500/20 px-1.5 py-0.2 rounded">
                      Equities
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans leading-tight">
                    AI-synthesized tokenized equities (xNVDA, xAAPL, xMSFT) with sub-second autonomous Pyth drift correction.
                  </div>
                  <div className="text-[11px] font-bold text-white pt-1">
                    Active Capital: ${activePositionsValue.toFixed(2)} USDC
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 space-y-2.5 text-xs font-mono transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
              }`}
            >
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Vault PDA Formula:</span>
                <span className={`font-semibold ${isLight ? 'text-sky-700' : 'text-[#00D2FF]'}`}>
                  [b"stockpilot_vault", user_pubkey]
                </span>
              </div>
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Clock Sysvar Cooldown:</span>
                <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>
                  {cooldownSeconds > 0 ? `${cooldownSeconds}s remaining` : 'Ready (0s)'}
                </span>
              </div>
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Protocol Fee:</span>
                <span className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  0.15% (15 bps to Treasury)
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Network Cluster:</span>
                <span className={`font-semibold ${isLight ? 'text-sky-700' : 'text-[#00D2FF]'}`}>
                  Solana Devnet (Verified)
                </span>
              </div>
            </div>

            {/* Verified On-Chain Devnet Proof Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faShieldHalved} className="w-3 h-3 text-[#00D2FF]" />
                  <span>Verified On-Chain Activity (Solana Devnet)</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  4 Confirmed TXs
                </span>
              </div>

              <div className="space-y-1.5">
                {[
                  {
                    action: 'Initialize Vault PDA',
                    sig: '4Vff2RFdsqCKDgMatUvLHa9coVtMdRhDz6iC4iKbKKXZr4XSCGtiFQJNzPSbvFL48m5YrP21faGHi6krdi3Jaip',
                    detail: 'Seeds: [b"stockpilot_vault", authority]',
                    badge: 'Init',
                  },
                  {
                    action: 'Deposit + 0.15% Fee Split',
                    sig: '2vFVU6FPTMJsPuKQpJi8C5WoXzN6fXNNLcitoXCd8YaHfm8n2CqxCrveisMiSZVgXx8JojafoPCUYB17qejdgVQB',
                    detail: 'CPI Split to Treasury (15 bps)',
                    badge: 'Deposit',
                  },
                  {
                    action: 'Autonomous Rebalance Execution',
                    sig: '5ZrygkZ259W3QrbmYHrfkf8JPXZWJ6rrV4NnP1MJ95PSjhP1CU8y9Gm9h2WZAFb1dsBg31A8pdvRA5FPakvMACR9',
                    detail: 'Drift rebalance + cooldown reset',
                    badge: 'Rebalance',
                  },
                  {
                    action: 'Vault Withdrawal to Owner',
                    sig: '48TzJeinNWPZdb2B5ALG5fYTv6MfYq9cgLWxWnHd7xVrvjtoAWt4A2x3Ypd2tCxo4PsyHtLY4nvEhTqfifiasLuU',
                    detail: '0.02 SOL withdrawn to signer',
                    badge: 'Withdraw',
                  },
                ].map((item) => (
                  <a
                    key={item.sig}
                    href={`https://solscan.io/tx/${item.sig}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className={`block rounded-xl border p-2.5 text-xs font-mono transition group ${
                      isLight
                        ? 'bg-white border-slate-200 hover:border-sky-400 shadow-sm'
                        : 'bg-[#0B111C] border-[#1E293B] hover:border-[#00D2FF]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-[#00D2FF] transition">
                        <span>{item.action}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-slate-400 font-normal">
                          {item.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#00D2FF] group-hover:underline">
                        Solscan ↗
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{item.detail}</span>
                      <span className="font-mono text-slate-400">{item.sig.slice(0, 8)}...{item.sig.slice(-6)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Audit Log */}
            <div className="space-y-1.5 pt-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase px-1">
                Recent User Session Activity
              </div>
              {txHistory.map((tx) => (
                <div
                  key={tx.id}
                  className={`rounded-xl border p-3 text-xs font-mono space-y-1 transition-colors ${
                    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
                  }`}
                >
                  <div className="flex justify-between font-semibold">
                    <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{tx.reason}</span>
                    <span className={isLight ? 'text-sky-600' : 'text-[#00D2FF]'}>
                      ${tx.amountUsdc.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    <span>{tx.txSignature.slice(0, 14)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Bar (Pinned strictly at bottom, shrink-0, never scrolls off) */}
      <div
        className={`shrink-0 border-t px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-around z-30 backdrop-blur-xl transition-colors ${
          isLight ? 'bg-white/95 border-slate-200 shadow-lg' : 'bg-[#080D18]/95 border-[#1E293B]'
        }`}
      >
        {[
          { id: 'portfolio', label: 'Portfolio', icon: faChartLine },
          { id: 'baskets', label: 'Trade', icon: faLayerGroup },
          { id: 'ai', label: 'AI Builder', icon: faRobot },
          { id: 'vault', label: 'Vault', icon: faShieldHalved },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
                isActive
                  ? isLight
                    ? 'text-sky-600 font-bold'
                    : 'text-[#00D2FF] font-bold'
                  : isLight
                  ? 'text-slate-400 hover:text-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
              <span className="text-[10px] tracking-tight font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
    );
  };

  return (
    <div
      className={`min-h-screen relative transition-colors max-w-full overflow-x-hidden w-full ${
        viewMode === 'app' ? 'h-screen h-[100dvh] overflow-hidden' : ''
      } ${
        isLight
          ? 'bg-[#F8FAFC] text-slate-900 selection:bg-sky-500/20 selection:text-sky-800'
          : 'bg-[#06080F] text-slate-100 selection:bg-[#00D2FF]/20 selection:text-[#00D2FF]'
      }`}
    >
      {/* Anime City Skyline Atmospheric Background (Daylight in Light Mode, Cyberpunk Neon at Night) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-700">
        <Image
          src={isLight ? '/anime-city-day-bg.jpg' : '/anime-city-bg.jpg'}
          alt={isLight ? 'Anime Solar Eco City Daylight' : 'Anime Cyberpunk City'}
          fill
          priority
          sizes="100vw"
          className={`object-cover object-center transition-all duration-700 ${
            isLight ? 'opacity-40' : 'opacity-45'
          }`}
        />
      </div>

      {/* Atmospheric Vignette & Depth Overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-700 ${
          isLight
            ? 'bg-gradient-to-b from-[#F8FAFC]/25 via-[#F8FAFC]/50 to-[#F8FAFC]/80'
            : 'bg-gradient-to-b from-[#06080F]/65 via-[#06080F]/80 to-[#06080F]/95'
        }`}
      />

      {/* Main Header (Clean, Minimalist, Responsive with Mobile Hamburger Drawer) */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors ${
          isLight ? 'bg-white/95 border-slate-200 shadow-sm' : 'bg-[#06080F]/95 border-[#1E293B]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => {
                setViewMode('website');
                setIsMobileMenuOpen(false);
              }}
              className="cursor-pointer group shrink-0"
            >
              <StockPilotLogo size={34} showText={true} theme={theme} />
            </div>

            {/* Desktop Nav Links (Only visible on landing page) */}
            {viewMode === 'website' && (
              <nav className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => {
                    setViewMode('website');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'website'
                      ? isLight
                        ? 'bg-slate-200/80 text-slate-900 font-bold'
                        : 'bg-white/10 text-white font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => {
                    if (viewMode !== 'website') setViewMode('website');
                    setTimeout(() => {
                      const el = document.getElementById('why-stockpilot');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Features
                </button>
              </nav>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Actions (Hidden on Mobile) */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />

              {/* 1-Tap Devnet Faucet Button */}
              <button
                onClick={() => setIsFaucetOpen(true)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-sm'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
                title="Claim 1,000 Devnet USDC Test Credits"
              >
                <FontAwesomeIcon icon={faBolt} className="w-3 h-3 text-emerald-400" />
                <span>Devnet Faucet</span>
              </button>

              {viewMode === 'website' ? (
                <button
                  onClick={() => handleLaunchApp()}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-lg ${
                    isLight
                      ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                      : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                  }`}
                >
                  <span>Launch App</span>
                  <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('website')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                  <span>Overview</span>
                </button>
              )}

              {privyAuthenticated && privyUser ? (
                <div className="flex items-center gap-2 bg-[#00D2FF]/10 border border-[#00D2FF]/30 rounded-xl px-3 py-1.5 text-xs font-mono">
                  <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-[#00D2FF]" />
                  <span className="max-w-[140px] truncate text-slate-200 font-semibold">
                    {privyUser.email?.address || privyUser.google?.email || (privySolanaAddress ? `${privySolanaAddress.slice(0, 4)}...${privySolanaAddress.slice(-4)}` : 'Logged In')}
                  </span>
                  <button
                    onClick={() => privyLogout()}
                    title="Sign Out"
                    className="ml-1 text-slate-400 hover:text-rose-400 transition cursor-pointer p-0.5"
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => privyLogin()}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm ${
                      isLight
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    }`}
                    title="Sign in with Email or Google (Instant Embedded Wallet)"
                  >
                    <FontAwesomeIcon icon={faEnvelope} className="w-3 h-3 text-[#00D2FF]" />
                    <span>Email Login</span>
                  </button>

                  <div className="scale-95">
                    <WalletMultiButton
                      style={{
                        backgroundColor: isLight ? '#0F172A' : '#101929',
                        border: isLight ? '1px solid #CBD5E1' : '1px solid #1E293B',
                        borderRadius: '0.75rem',
                        height: '36px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Actions (Compact Theme + App Launch + Hamburger Menu) */}
            <div className="flex md:hidden items-center gap-1.5">
              <ThemeToggle theme={theme} onToggle={toggleTheme} compact={true} />

              {viewMode === 'website' ? (
                <button
                  onClick={() => handleLaunchApp()}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                    isLight
                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                      : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8]'
                  }`}
                >
                  <span>App</span>
                  <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" />
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('website')}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-white/10 border-white/10 text-slate-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-2.5 h-2.5" />
                  <span>Site</span>
                </button>
              )}

              {/* Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle Menu"
                className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  isMobileMenuOpen
                    ? isLight
                      ? 'bg-slate-200 border-slate-300 text-slate-900'
                      : 'bg-[#1E293B] border-[#00D2FF]/40 text-[#00D2FF]'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#0A101D] border-[#1E293B] text-slate-300 hover:text-white hover:bg-[#131C2E]'
                }`}
              >
                <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {isMobileMenuOpen && (
          <div
            className={`md:hidden border-b px-4 py-4 space-y-3 backdrop-blur-2xl transition-all shadow-2xl ${
              isLight ? 'bg-white/98 border-slate-200 shadow-slate-200/50' : 'bg-[#06080F]/98 border-[#1E293B] shadow-black/80'
            }`}
          >
            {/* Quick Launch Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  handleLaunchApp();
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-xs transition cursor-pointer shadow-md ${
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                }`}
              >
                <FontAwesomeIcon icon={faMobileScreen} className="w-3.5 h-3.5" />
                <span>Launch App</span>
              </button>

              <button
                onClick={() => {
                  setIsFaucetOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-xs transition cursor-pointer border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-emerald-400" />
                <span>Devnet Faucet</span>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1 pt-1 font-mono text-xs">
              <button
                onClick={() => {
                  setIsFaucetOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-semibold transition cursor-pointer border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Devnet Faucet (+1,000 USDC)</span>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 text-emerald-400" />
              </button>

              <button
                onClick={() => {
                  setViewMode('website');
                  setIsMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Overview & Hero</span>
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  if (viewMode !== 'website') setViewMode('website');
                  setIsMobileMenuOpen(false);
                  setTimeout(() => {
                    document.getElementById('why-stockpilot')?.scrollIntoView({ behavior: 'smooth' });
                  }, 150);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Institutional Features</span>
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 text-slate-500" />
              </button>

              <a
                href="https://github.com/southenempire/stockpilot"
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faGithub} className="w-3.5 h-3.5" />
                  GitHub Repository
                </span>
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 text-slate-500" />
              </a>
            </div>

            {/* Wallet / Auth section in Drawer */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
              {privyAuthenticated && privyUser ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <FontAwesomeIcon icon={faEnvelope} className="w-3 h-3 text-[#00D2FF]" />
                    <span className="truncate text-slate-200">
                      {privyUser.email?.address || privyUser.google?.email || (privySolanaAddress ? `${privySolanaAddress.slice(0, 4)}...${privySolanaAddress.slice(-4)}` : 'Logged In')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      privyLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-rose-400 hover:underline text-[11px] font-bold shrink-0 ml-2 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      privyLogin();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    }`}
                  >
                    <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-[#00D2FF]" />
                    <span>Sign In with Email / Google</span>
                  </button>
                  <div className="flex justify-center w-full">
                    <WalletMultiButton
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        backgroundColor: isLight ? '#0F172A' : '#101929',
                        border: isLight ? '1px solid #CBD5E1' : '1px solid #1E293B',
                        borderRadius: '0.75rem',
                        height: '38px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* VIEW MODE 1: PRODUCT LANDING PAGE */}
      {viewMode === 'website' ? (
        <LandingView
          theme={theme}
          campaignPhrase={campaignPhrases[cycleIndex]}
          onLaunchApp={handleLaunchApp}
          renderMockupContent={() => renderMobileAppContent(true)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-0 sm:p-6 md:p-8">
          <div
            className={`w-full max-w-lg h-full sm:h-[840px] sm:max-h-[90vh] flex flex-col sm:rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
              isLight
                ? 'bg-white border-slate-200 shadow-slate-300/40'
                : 'bg-[#06080F] border-[#1E293B] shadow-black/80'
            }`}
          >
            {renderMobileAppContent(false)}
          </div>
        </div>
      )}

      {/* MODALS */}
      <RebalanceModal
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
        holdings={computedHoldings}
        totalValueUsdc={activePositionsValue}
        onConfirmRebalance={handleConfirmRebalance}
        theme={theme}
        publicKey={publicKey}
      />

      <BuyModal
        isOpen={isBuyModalOpen}
        onClose={() => {
          setIsBuyModalOpen(false);
          setBuyTargetBasket(null);
          setBuyTargetStock(null);
        }}
        targetBasket={buyTargetBasket}
        targetStock={buyTargetStock}
        realSolBalance={realSolBalance}
        realUsdcBalance={realUsdcBalance}
        solPriceUsd={solPriceUsd}
        theme={theme}
        onBuySuccess={handleBuySuccess}
      />

      <SocialFlexCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        strategyName={selectedStrategy.name}
        totalValueUsdc={totalValueUsdc}
        pnlPercent={pnlPercent}
        holdings={computedHoldings}
        theme={theme}
      />

      <PromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onSelectStrategy={(s) => {
          handleSelectStrategy(s);
          setActiveTab('portfolio');

          // Persist custom strategy to backend database
          if (publicKey) {
            fetch('/api/user/strategies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rawIdentifier: publicKey.toBase58(),
                strategy: {
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  targetWeights: Object.fromEntries(
                    s.tokens.map((t) => [t.symbol, t.targetWeight])
                  ),
                },
              }),
            }).catch(console.warn);
          }
        }}
        theme={theme}
      />

      <TourModal
        isOpen={isTourOpen}
        onClose={() => {
          setIsTourOpen(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('stockpilot_tour_seen', 'true');
          }
        }}
        onStartDemo={() => {
          setActiveTab('portfolio');
          if (typeof window !== 'undefined') {
            localStorage.setItem('stockpilot_tour_seen', 'true');
          }
        }}
        theme={theme}
      />

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        theme={theme}
        portfolioValueUsdc={totalValueUsdc}
        vaultCashReserveUsdc={vaultCashReserveUsdc}
        activePositionsUsdc={activePositionsValue}
        realSolBalance={realSolBalance}
        realUsdcBalance={realUsdcBalance}
        realVaultBalance={realVaultBalance}
        solPriceUsd={solPriceUsd}
        connected={connected}
        publicKey={publicKey}
        onWithdrawSuccess={handleWithdrawSuccess}
      />

      {/* 1-Tap Deploy Modal (Layer 1 Cash Reserve -> Layer 2 Strategy Basket) */}
      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        theme={theme}
        vaultCashReserveUsdc={vaultCashReserveUsdc}
        selectedStrategy={selectedStrategy}
        onDeploySuccess={handleDeployCashReserve}
        connected={connected}
        publicKey={publicKey}
      />

      {/* Real On-Chain Deposit Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        theme={theme}
        strategyName={selectedStrategy.name}
        strategyId={selectedStrategy.id}
        holdings={computedHoldings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          targetWeight: h.targetWeight,
        }))}
        realSolBalance={realSolBalance}
        realUsdcBalance={realUsdcBalance}
        solPriceUsd={solPriceUsd}
        connected={connected}
        publicKey={publicKey}
        onDepositSuccess={handleDepositSuccess}
      />

      {/* 1-Tap Solana Devnet Faucet Modal */}
      <DevnetFaucetModal
        isOpen={isFaucetOpen}
        onClose={() => setIsFaucetOpen(false)}
        walletAddress={publicKey?.toBase58()}
        onSuccessFund={() => {
          fetchRealBalances();
        }}
      />
    </div>
  );
}
