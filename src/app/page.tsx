'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { PREBUILT_STRATEGIES } from '@/data/strategies';
import { SUPPORTED_STOCKS } from '@/data/stocks';
import { BasketStrategy, PortfolioHolding, RebalanceTx, Stock } from '@/types/stock';
import { calculatePortfolioState, analyzeDrift } from '@/lib/solana/rebalance-engine';
import { generateAiStrategy } from '@/lib/ai/strategy-generator';
import HoldingRow from '@/components/HoldingRow';
import StrategyCard from '@/components/StrategyCard';
import RebalanceModal from '@/components/RebalanceModal';
import BuyModal from '@/components/BuyModal';
import SocialFlexCardModal from '@/components/SocialFlexCardModal';
import PromptModal from '@/components/PromptModal';
import TourModal from '@/components/TourModal';
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
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter, faGithub, faDiscord } from '@fortawesome/free-brands-svg-icons';

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
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();

  // Master view state: website presentation vs direct mobile app view
  const [viewMode, setViewMode] = useState<'website' | 'app'>('website');

  // Mobile App Navigation tabs
  const [activeTab, setActiveTab] = useState<'portfolio' | 'baskets' | 'ai' | 'vault'>('portfolio');

  // App & Wallet state: Live Mainnet is DEFAULT (Simulated Demo is strictly OPT-IN)
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoBalanceUsdc, setDemoBalanceUsdc] = useState(10000);
  const [selectedStrategy, setSelectedStrategy] = useState<BasketStrategy>(PREBUILT_STRATEGIES[0]);
  const [driftTolerance, setDriftTolerance] = useState(5.0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1M');

  // Real On-Chain Balances (Solana Mainnet)
  const [realSolBalance, setRealSolBalance] = useState<number | null>(null);
  const [realUsdcBalance, setRealUsdcBalance] = useState<number | null>(null);
  const [solPriceUsd, setSolPriceUsd] = useState<number>(138.50);
  const [isLoadingRealBalances, setIsLoadingRealBalances] = useState<boolean>(false);

  // Dynamic campaign cycle phrase in hero
  const campaignPhrases = ['Cheaper.', 'Simpler.', 'Smarter.'];
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % campaignPhrases.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [campaignPhrases.length]);

  // Price registry
  const [livePrices, setLivePrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.values(SUPPORTED_STOCKS).forEach((s) => {
      initial[s.symbol] = s.price;
    });
    return initial;
  });

  // Holdings state
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    const initialCapital = 10000;
    return PREBUILT_STRATEGIES[0].tokens.map((t) => {
      const stock = SUPPORTED_STOCKS[t.symbol];
      const allocUsdc = initialCapital * t.targetWeight;
      const shares = allocUsdc / stock.price;
      return {
        symbol: t.symbol,
        name: stock.name,
        shares,
        currentPrice: stock.price,
        currentValue: allocUsdc,
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
  const [isSandboxDrawerOpen, setIsSandboxDrawerOpen] = useState(false);

  // Modals
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [buyTargetBasket, setBuyTargetBasket] = useState<BasketStrategy | null>(null);

  // First-time visitor onboarding tour auto-detection
  useEffect(() => {
    try {
      const tourDismissed = localStorage.getItem('stockpilot_tour_dismissed');
      if (!tourDismissed) {
        setIsTourOpen(true);
      }
    } catch {}
  }, []);
  const [buyTargetStock, setBuyTargetStock] = useState<Stock | null>(null);
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
      amountUsdc: 10000,
      txSignature: '4h9Km7uQ8rZ2xL9PnTv8W2k1Y5mC3xJ8vQ2L4aB7n9K',
      reason: 'Vault initialized with AI Compute & Silicon Index on Mainnet',
    },
  ]);

  // Recalculate portfolio state
  const { totalValueUsdc, holdings: computedHoldings } = calculatePortfolioState(
    holdings,
    livePrices
  );

  // Analyze drift
  const driftAnalysis = analyzeDrift(computedHoldings, totalValueUsdc, driftTolerance);

  // Real-time on-chain balance fetcher from Solana Mainnet
  useEffect(() => {
    if (!connected || !publicKey) {
      setRealSolBalance(null);
      setRealUsdcBalance(null);
      return;
    }

    let isMounted = true;

    const fetchRealBalances = async () => {
      setIsLoadingRealBalances(true);
      try {
        // 1. Fetch Real SOL Balance
        const lamports = await connection.getBalance(publicKey);
        if (isMounted) {
          setRealSolBalance(lamports / LAMPORTS_PER_SOL);
        }

        // 2. Fetch Real USDC SPL Token Balance (Mainnet USDC Mint)
        try {
          const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: usdcMint,
          });
          if (tokenAccounts.value && tokenAccounts.value.length > 0) {
            const parsedInfo = tokenAccounts.value[0].account.data.parsed.info;
            const uiAmount = parsedInfo.tokenAmount.uiAmount || 0;
            if (isMounted) setRealUsdcBalance(uiAmount);
          } else {
            if (isMounted) setRealUsdcBalance(0);
          }
        } catch (tokenErr) {
          console.warn('USDC token balance query warning:', tokenErr);
          if (isMounted && realUsdcBalance === null) setRealUsdcBalance(0);
        }

        // 3. Fetch live SOL/USD price
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
          if (res.ok) {
            const data = await res.json();
            if (data?.solana?.usd && isMounted) {
              setSolPriceUsd(data.solana.usd);
            }
          }
        } catch {
          // Keep default fallback
        }
      } catch (err) {
        console.warn('Solana balance query error:', err);
        if (isMounted) {
          if (realSolBalance === null) setRealSolBalance(0);
          if (realUsdcBalance === null) setRealUsdcBalance(0);
        }
      } finally {
        if (isMounted) setIsLoadingRealBalances(false);
      }
    };

    fetchRealBalances();
    const interval = setInterval(fetchRealBalances, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [connected, publicKey, connection]);

  // Real live net worth calculations on Solana Mainnet
  const liveSolVal = realSolBalance !== null ? realSolBalance * solPriceUsd : 0;
  const liveUsdcVal = realUsdcBalance !== null ? realUsdcBalance : 0;
  const realTotalNetWorth = liveSolVal + liveUsdcVal;

  // Active Portfolio Net Asset Value based on environment & wallet connection
  const activeNetAssetValue = isDemoMode
    ? totalValueUsdc
    : connected
    ? realTotalNetWorth
    : 0;

  // PnL metrics
  const baselineCapital = isDemoMode ? demoBalanceUsdc : 10000;
  const pnlUsdc = totalValueUsdc - baselineCapital;
  const pnlPercent = Number(((pnlUsdc / baselineCapital) * 100).toFixed(2));

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Handle strategy switch
  const handleSelectStrategy = (strat: BasketStrategy) => {
    setSelectedStrategy(strat);
    const updated = strat.tokens.map((t) => {
      const stock = SUPPORTED_STOCKS[t.symbol];
      const targetVal = totalValueUsdc * t.targetWeight;
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

  // Vault Rebalance execution
  const handleConfirmRebalance = () => {
    const updated = computedHoldings.map((h) => {
      const targetVal = totalValueUsdc * h.targetWeight;
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

    setTxHistory((prev) => [
      {
        id: `tx_${Date.now()}`,
        timestamp: Date.now(),
        fromAsset: 'Drifted Basket',
        toAsset: 'Target Weights',
        amountUsdc: driftAnalysis.rebalanceTransactions.reduce((acc, t) => acc + t.amountUsdc, 0),
        txSignature: Array.from({ length: 44 }, () =>
          '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
        ).join(''),
        reason: `Rebalanced ${selectedStrategy.name} on Solana Mainnet`,
      },
      ...prev,
    ]);
  };

  // Handle Deposit
  const handleDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    setDemoBalanceUsdc((b) => b + amt);
    const updated = computedHoldings.map((h) => {
      const alloc = amt * h.targetWeight;
      return {
        ...h,
        shares: h.shares + alloc / h.currentPrice,
        currentValue: h.currentValue + alloc,
      };
    });
    setHoldings(updated);
    setTxHistory((p) => [
      {
        id: `tx_dep_${Date.now()}`,
        timestamp: Date.now(),
        fromAsset: 'USDC',
        toAsset: selectedStrategy.name,
        amountUsdc: amt,
        txSignature: '5Q8vNm9P1X2kL8wZ3vR4tY7pA1mC9xB2nD6eF3gH',
        reason: `Deposit ${amt} USDC into vault allocation`,
      },
      ...p,
    ]);
    setIsDepositOpen(false);
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
        const allocUsdc = amountUsdc * t.targetWeight;
        const shares = allocUsdc / price;
        return {
          symbol: t.symbol,
          name: stock.name,
          shares,
          currentPrice: price,
          currentValue: allocUsdc,
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
          reason: `Invested $${amountUsdc.toFixed(2)} in ${basket.name} on Solana`,
        },
        ...prev,
      ]);
    }

    if (isDemoMode) {
      setDemoBalanceUsdc((prev) => prev + amountUsdc);
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

  // Mobile App Content Component (with isInsideMockup and optional forceDemoMode)
  const renderMobileAppContent = (isInsideMockup = false, forceDemoMode?: boolean) => {
    const activeDemo = forceDemoMode !== undefined ? forceDemoMode : isDemoMode;
    return (
    <div
      className={`w-full h-full flex flex-col transition-colors relative overflow-hidden ${
        isInsideMockup ? 'max-h-[580px]' : ''
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
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeDemo
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
            }`}
            title="Toggle between Live Mainnet and $10K Demo Sandbox"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>{activeDemo ? '⚡ $10K Demo' : '● Live Mainnet'}</span>
          </button>

          <button
            onClick={() => {
              if (connected) {
                disconnect();
              } else {
                openWalletModal(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer shrink-0 shadow-sm ${
              connected && publicKey
                ? isLight
                  ? 'bg-sky-50 border border-sky-200 text-sky-800'
                  : 'bg-sky-500/10 border border-sky-500/20 text-[#00D2FF]'
                : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-md shadow-[#00D2FF]/20'
            }`}
            title={connected ? 'Connected (Click to Disconnect)' : 'Click to Select Wallet'}
          >
            <FontAwesomeIcon icon={faWallet} className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap font-bold">
              {connected && publicKey
                ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-3)}`
                : 'Select Wallet'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content (Constrained with min-h-0 so ONLY this area scrolls internally) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-8">
        {/* TAB 1: PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div className="space-y-4">
            {activeDemo ? (
              /* ================= DEMO SANDBOX ENVIRONMENT (STRICTLY OPT-IN) ================= */
              <>
                {/* Demo Sandbox Banner */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><strong>$10K Demo Sandbox:</strong> Testing with simulated funds. Real wallet untouched.</span>
                  </div>
                  <button
                    onClick={() => setIsDemoMode(false)}
                    className="font-bold text-amber-400 hover:underline shrink-0 text-[11px] cursor-pointer"
                  >
                    Exit Demo &rarr;
                  </button>
                </div>

                {/* Simulated Balance Card */}
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
                    <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Demo Portfolio Value</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isLight
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      $10K Demo Sandbox
                    </span>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
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
                    <span className="text-xs font-mono text-slate-500">USDC</span>
                  </div>

                  {/* Monthly Gain Pill */}
                  <div className="mt-2 flex items-center gap-2">
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
                    <span className="text-[11px] text-slate-400">simulated drift</span>
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
                  <div className={`mt-4 pt-3 border-t grid grid-cols-3 gap-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                    <button
                      onClick={() => setIsDepositOpen(true)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faPlus} className="w-3 h-3 text-[#00D2FF]" />
                      <span>Deposit</span>
                    </button>

                    <button
                      onClick={() => setIsRebalanceModalOpen(true)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm ${
                        driftAnalysis.hasDrift
                          ? isLight
                            ? 'bg-sky-600 text-white shadow-sky-600/20'
                            : 'bg-[#00D2FF] text-[#06080F] shadow-[#00D2FF]/20 animate-pulse'
                          : isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/10 hover:bg-white/15 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faArrowsRotate} className="w-3 h-3" />
                      <span>Rebalance</span>
                    </button>

                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <FontAwesomeIcon icon={faShareNodes} className="w-3 h-3 text-sky-400" />
                      <span>Share</span>
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

                {/* Market Shock Simulator (Demo Sandbox Only) */}
                <div
                  className={`rounded-2xl border p-4 transition-colors ${
                    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faFire} className="text-amber-500 w-4 h-4" />
                      <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Market Shock Simulator
                      </span>
                    </div>
                    <button
                      onClick={() => setIsSandboxDrawerOpen(!isSandboxDrawerOpen)}
                      className={`text-[11px] font-mono font-semibold transition cursor-pointer ${
                        isLight ? 'text-sky-600 hover:text-sky-700' : 'text-[#00D2FF] hover:underline'
                      }`}
                    >
                      {isSandboxDrawerOpen ? 'Hide' : 'Test Volatility'}
                    </button>
                  </div>

                  {isSandboxDrawerOpen && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/50 dark:border-white/5">
                      <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Simulate price movements to test autonomous drift rebalancing:
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <button
                          onClick={() => applyShock('xNVDA', 1.2)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              : 'bg-[#101828] border-[#1E293B] hover:bg-[#162338]'
                          }`}
                        >
                          <div className="font-bold text-emerald-500">NVDA +20%</div>
                          <div className="text-[10px] text-slate-400">Earnings Beat Surge</div>
                        </button>
                        <button
                          onClick={() => applyShock('xAMD', 0.85)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              : 'bg-[#101828] border-[#1E293B] hover:bg-[#162338]'
                          }`}
                        >
                          <div className="font-bold text-rose-500">AMD -15%</div>
                          <div className="text-[10px] text-slate-400">Hardware Pullback</div>
                        </button>
                        <button
                          onClick={() => {
                            applyShock('xNVDA', 1.12);
                            applyShock('xTSM', 1.15);
                            applyShock('xMSFT', 1.08);
                          }}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              : 'bg-[#101828] border-[#1E293B] hover:bg-[#162338]'
                          }`}
                        >
                          <div className="font-bold text-sky-400">Tech Rally +12%</div>
                          <div className="text-[10px] text-slate-400">Broad Sector Surge</div>
                        </button>
                        <button
                          onClick={resetPrices}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              : 'bg-[#101828] border-[#1E293B] hover:bg-[#162338]'
                          }`}
                        >
                          <div className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                            Reset Prices
                          </div>
                          <div className="text-[10px] text-slate-400">Restore Baseline</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ================= LIVE SOLANA MAINNET ENVIRONMENT (DEFAULT) ================= */
              <>
                {/* Real Live Solana Mainnet Balance Card */}
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
                      priority
                      sizes="(max-width: 640px) 144px, 192px"
                      className="object-cover object-top opacity-40 dark:opacity-55 transition-all duration-500 group-hover:scale-105 group-hover:opacity-70"
                    />
                    {/* Seamless left-to-right fade overlay so warrior blends smoothly into the card surface */}
                    <div
                      className={`absolute inset-0 ${
                        isLight
                          ? 'bg-gradient-to-r from-white via-white/50 to-transparent'
                          : 'bg-gradient-to-r from-[#0E1524] via-[#0E1524]/60 to-transparent'
                      }`}
                    />
                    {/* Bottom fade */}
                    <div
                      className={`absolute inset-0 ${
                        isLight
                          ? 'bg-gradient-to-t from-white via-transparent to-transparent'
                          : 'bg-gradient-to-t from-[#080D17] via-transparent to-transparent'
                      }`}
                    />
                    {/* Subtle cyan glow around warrior visor */}
                    <div className="absolute top-4 right-4 w-20 h-20 bg-[#00D2FF]/20 rounded-full blur-xl pointer-events-none" />
                  </div>

                  <div className="relative z-10">
                    <div className="text-[11px] font-bold uppercase tracking-wider font-mono flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                        <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>
                          {connected ? 'Wallet Portfolio' : 'Portfolio'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isLight
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        Non-Custodial
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <div
                        className={`font-mono text-3xl font-extrabold tracking-tight ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                      $
                      {(connected ? realTotalNetWorth : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <span className="text-xs font-mono text-slate-500">USD</span>
                  </div>

                  {/* Real Token Breakdown Chips when Connected */}
                  {connected && publicKey ? (
                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <span className="font-bold text-[#00D2FF]">SOL:</span>
                        <span>
                          {realSolBalance !== null
                            ? `${realSolBalance.toFixed(3)} ($${liveSolVal.toFixed(2)})`
                            : isLoadingRealBalances
                            ? 'Syncing...'
                            : '0.000 ($0.00)'}
                        </span>
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <span className="font-bold text-emerald-400">USDC:</span>
                        <span>
                          {realUsdcBalance !== null
                            ? `$${realUsdcBalance.toFixed(2)}`
                            : isLoadingRealBalances
                            ? 'Syncing...'
                            : '$0.00'}
                        </span>
                      </div>
                      <div className="w-full text-[10px] font-mono text-slate-400 pt-0.5">
                        Connected: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-400 leading-relaxed">
                      Connect your Solana wallet to view your real on-chain balance and manage Anchor PDA vaults, or test with simulated funds in the Demo Sandbox.
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className={`mt-4 pt-3 border-t grid grid-cols-2 gap-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                    {connected ? (
                      <>
                        <button
                          onClick={() => {
                            setBuyTargetBasket(selectedStrategy);
                            setBuyTargetStock(null);
                            setIsBuyModalOpen(true);
                          }}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                            isLight
                              ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                              : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                          }`}
                        >
                          <FontAwesomeIcon icon={faBolt} className="w-3 h-3" />
                          <span>+ Buy / Trade</span>
                        </button>

                        <button
                          onClick={() => setIsDepositOpen(true)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                              : 'bg-white/5 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                          <span>Deposit Funds</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openWalletModal(true)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                            isLight
                              ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                              : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                          }`}
                        >
                          <FontAwesomeIcon icon={faWallet} className="w-3 h-3" />
                          <span>Connect Wallet</span>
                        </button>

                        <button
                          onClick={() => setIsDemoMode(true)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
                            isLight
                              ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                              : 'bg-white/5 hover:bg-white/10 text-slate-200'
                          }`}
                          title="Switch to $10K Demo Sandbox to simulate strategies"
                        >
                          <FontAwesomeIcon icon={faBolt} className="w-3 h-3 text-amber-400" />
                          <span>Try $10K Demo</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

                {/* Live Vault Status & Target Basket Allocation */}
                {connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className={`font-bold font-mono uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Anchor Vault · {selectedStrategy.name}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        0.0% Drift · Balanced
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedStrategy.tokens.map((t) => {
                        const stock = SUPPORTED_STOCKS[t.symbol];
                        return (
                          <div
                            key={t.symbol}
                            className={`rounded-2xl border p-3 flex items-center justify-between transition ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#0B111C] border-[#1E293B]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#00D2FF]/10 text-[#00D2FF] flex items-center justify-center font-bold text-xs font-mono">
                                {t.symbol.replace('x', '')}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span>{t.symbol}</span>
                                  <span className="text-[10px] text-slate-400">({stock.name})</span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  ${stock.price.toFixed(2)} · Live Pyth
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="font-mono text-xs font-bold text-[#00D2FF]">
                                  {(t.targetWeight * 100).toFixed(0)}% Target
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  0.0% Drift
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBuyTargetBasket(null);
                                  setBuyTargetStock(stock);
                                  setIsBuyModalOpen(true);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                                  isLight
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                                    : 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 hover:bg-[#00D2FF]/20'
                                }`}
                              >
                                + Buy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button
                        onClick={() => {
                          setBuyTargetBasket(selectedStrategy);
                          setBuyTargetStock(null);
                          setIsBuyModalOpen(true);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-[#00D2FF] text-[#06080F] font-bold text-xs hover:bg-[#38BDF8] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                      >
                        <FontAwesomeIcon icon={faBolt} className="w-3 h-3" />
                        <span>+ Invest in {selectedStrategy.name}</span>
                      </button>
                      <button
                        onClick={() => setIsRebalanceModalOpen(true)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs border border-white/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faArrowsRotate} className="w-3 h-3 text-[#00D2FF]" />
                        <span>Rebalance</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl border p-6 text-center space-y-3 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#0B111C] border-[#1E293B]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-sky-500/10 text-[#00D2FF] flex items-center justify-center mx-auto">
                      <FontAwesomeIcon icon={faWallet} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        No Live Wallet Connected
                      </h4>
                      <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Connect your Solana wallet to view live Anchor PDA vault equity allocations on Solana Mainnet.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => openWalletModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#00D2FF] text-[#06080F] font-bold text-xs hover:bg-[#38BDF8] transition cursor-pointer"
                      >
                        Connect Solana Wallet
                      </button>
                      <button
                        onClick={() => setIsDemoMode(true)}
                        className={`px-4 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        ⚡ Test with $10K Demo Sandbox
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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

            <div
              className={`rounded-2xl border p-4 space-y-2.5 text-xs font-mono transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111C] border-[#1E293B]'
              }`}
            >
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Vault PDA Formula:</span>
                <span className={`font-semibold ${isLight ? 'text-sky-700' : 'text-[#00D2FF]'}`}>
                  [b"stockpilot", user_pubkey]
                </span>
              </div>
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Clock Sysvar Cooldown:</span>
                <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>
                  {cooldownSeconds > 0 ? `${cooldownSeconds}s remaining` : 'Ready (0s)'}
                </span>
              </div>
              <div className={`flex justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-[#1E293B]'}`}>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Routing Engine:</span>
                <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>
                  Jupiter Ultra Atomic
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Network Cluster:</span>
                <span className={`font-semibold ${isLight ? 'text-sky-700' : 'text-[#00D2FF]'}`}>
                  Solana Mainnet-Beta
                </span>
              </div>
            </div>

            {/* Audit Log */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase px-1">
                Recent Transactions
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

      {/* Mobile Bottom Tab Bar (Pinned at bottom, shrink-0, never covered or pushed off) */}
      <div
        className={`shrink-0 border-t px-4 py-2.5 flex items-center justify-around z-30 backdrop-blur-xl transition-colors ${
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
      className={`min-h-screen relative transition-colors ${
        viewMode === 'app' ? 'h-screen overflow-hidden' : ''
      } ${
        isLight
          ? 'bg-[#0F172A] text-slate-900 selection:bg-sky-500/20 selection:text-sky-800'
          : 'bg-[#06080F] text-slate-100 selection:bg-[#00D2FF]/20 selection:text-[#00D2FF]'
      }`}
    >
      {/* Anime Cyber City Skyline Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-700">
        <Image
          src="/anime-city-bg.jpg"
          alt="Anime Cyberpunk City"
          fill
          priority
          sizes="100vw"
          className={`object-cover object-center ${isLight ? 'opacity-20' : 'opacity-45'}`}
        />
      </div>

      {/* Atmospheric Vignette & Depth Overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 ${
          isLight
            ? 'bg-gradient-to-b from-[#F8FAFC]/85 via-[#F8FAFC]/90 to-[#F8FAFC]'
            : 'bg-gradient-to-b from-[#06080F]/65 via-[#06080F]/80 to-[#06080F]/95'
        }`}
      />

      {/* Main Header (Clean, Minimalist, No spammy banners) */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors ${
          isLight ? 'bg-white/90 border-slate-200 shadow-sm' : 'bg-[#06080F]/90 border-[#1E293B]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <div
              onClick={() => setViewMode('website')}
              className="cursor-pointer group"
            >
              <StockPilotLogo size={36} showText={true} theme={theme} />
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive Tour Guide Button */}
            <button
              onClick={() => setIsTourOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-[#00D2FF]'
              }`}
              title="Open StockPilot Onboarding Tour"
            >
              <FontAwesomeIcon icon={faCompass} className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span className="hidden sm:inline">Tour</span>
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            {viewMode === 'website' ? (
              <button
                onClick={() => setViewMode('app')}
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
        </div>
      </header>

      {/* VIEW MODE 1: PRODUCT LANDING PAGE */}
      {viewMode === 'website' && (
        <div className="relative z-10">
          {/* Hero Section */}
          <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6">
            {/* Subtle cyan background glow */}
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] blur-[140px] pointer-events-none rounded-full ${
                isLight ? 'bg-sky-400/10' : 'bg-[#00D2FF]/10'
              }`}
            />

            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                {/* Hero Left Column (Copy & CTAs) */}
                <div className="lg:col-span-7 space-y-6">

                  {/* Title */}
                  <h1
                    className={`text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    The stock market Solana{' '}
                    <span className={isLight ? 'text-sky-600' : 'text-[#00D2FF]'}>
                      runs on.
                    </span>
                  </h1>

                  {/* Campaign Cycler (Cheaper. Simpler. Smarter.) */}
                  <div
                    className={`text-2xl sm:text-3xl font-extrabold tracking-tight transition-all duration-300 ${
                      isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                    }`}
                  >
                    {campaignPhrases[cycleIndex]}
                  </div>

                  {/* Subhead */}
                  <p
                    className={`text-base max-w-xl leading-relaxed ${
                      isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    The autonomous 24/7 stock robo-advisor built on Solana. Trade tokenized US equities
                    without market close, eliminate index drift with atomic Jupiter routing, and hold
                    non-custodial PDA vaults.
                  </p>

                  {/* CTA Block */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => setViewMode('app')}
                      className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition active:scale-95 cursor-pointer shadow-xl ${
                        isLight
                          ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                          : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                      }`}
                    >
                      <FontAwesomeIcon icon={faMobileScreen} className="w-4 h-4" />
                      <span>Launch Mobile App</span>
                      <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5 ml-1" />
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('app');
                        setIsDemoMode(true);
                      }}
                      className={`flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition cursor-pointer ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                          : 'border-[#1E293B] bg-[#0C121E] hover:bg-[#121B2B] text-slate-200'
                      }`}
                    >
                      <span>Try Demo Portfolio ($10K)</span>
                    </button>
                  </div>

                  {/* Trust indicator */}
                  <div
                    className={`flex items-center gap-2 text-xs pt-1 font-mono ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={faLock}
                      className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-[#00D2FF]'}`}
                    />
                    <span>Non-custodial PDA vault. Your keys, your stock shares.</span>
                  </div>

                  {/* 4 Proof Metric Cards Directly Integrated in Hero Left Column */}
                  <div
                    className={`pt-6 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 transition-colors ${
                      isLight ? 'border-slate-200' : 'border-[#1E293B]'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div
                        className={`font-mono text-2xl sm:text-3xl font-extrabold ${
                          isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                        }`}
                      >
                        24/7
                      </div>
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Always Open
                      </div>
                      <div className={`text-[11px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Zero market close.
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div
                        className={`font-mono text-2xl sm:text-3xl font-extrabold ${
                          isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                        }`}
                      >
                        0%
                      </div>
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Management
                      </div>
                      <div className={`text-[11px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Zero AUM drag.
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div
                        className={`font-mono text-2xl sm:text-3xl font-extrabold ${
                          isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                        }`}
                      >
                        &lt; $0.001
                      </div>
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Solana Gas
                      </div>
                      <div className={`text-[11px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Sub-cent rebalancing.
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div
                        className={`font-mono text-2xl sm:text-3xl font-extrabold ${
                          isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                        }`}
                      >
                        100%
                      </div>
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Non-Custodial
                      </div>
                      <div className={`text-[11px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Anchor PDA vaults.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hero Right Column: Live Interactive Mobile Phone Mockup */}
                <div className="lg:col-span-5 flex justify-center">
                  <div
                    className={`relative w-full max-w-[390px] rounded-[44px] border-[10px] shadow-2xl overflow-hidden ring-1 transition-all ${
                      isLight
                        ? 'border-slate-300 bg-white ring-black/5 shadow-slate-300/60'
                        : 'border-[#1E293B] bg-[#06080F] ring-white/10 shadow-black/80'
                    }`}
                  >
                    {/* Phone Notch Speaker */}
                    <div
                      className={`absolute top-2 left-1/2 -translate-x-1/2 h-4 w-28 rounded-full z-50 flex items-center justify-center ${
                        isLight ? 'bg-slate-300' : 'bg-[#1E293B]'
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full mr-2 ${
                          isLight ? 'bg-slate-400' : 'bg-[#06080F]'
                        }`}
                      />
                    </div>

                    {/* Embedded Live Mobile App inside Phone Mockup (isInsideMockup=true, forceDemoMode=true to showcase full demo portfolio) */}
                    <div className="pt-5 overflow-hidden">
                      {renderMobileAppContent(true, true)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Value Pillars Section (Cheaper, Simpler, Smarter) */}
          <section id="why-stockpilot" className="py-20 px-4 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-16">
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <span
                  className={`text-xs font-bold uppercase tracking-wider font-mono ${
                    isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                  }`}
                >
                  Why StockPilot on Solana
                </span>
                <h2
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Traditional robo-advisors are slow. <br />
                  <span className={isLight ? 'text-sky-600' : 'text-[#00D2FF]'}>
                    StockPilot runs in real time.
                  </span>
                </h2>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Wall Street closes at 4 PM. StockPilot monitors index drift 24/7 and keeps your
                  portfolio perfectly balanced.
                </p>
              </div>

              {/* 3 Pillar Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pillar 1: Cheaper */}
                <div
                  className={`rounded-3xl border p-6 space-y-4 transition ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isLight
                        ? 'bg-sky-50 border-sky-200 text-sky-600'
                        : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faBolt} className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Cheaper
                  </h3>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    No 2% management drag or hidden trading fees. Trades route through Jupiter Ultra for
                    zero slippage and sub-cent Solana transactions.
                  </p>
                  <ul className="space-y-2 text-xs font-mono pt-2">
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        Fractional shares from $1
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        Zero custody markup
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Pillar 2: Simpler */}
                <div
                  className={`rounded-3xl border p-6 space-y-4 transition ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isLight
                        ? 'bg-sky-50 border-sky-200 text-sky-600'
                        : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faArrowsRotate} className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Simpler
                  </h3>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Pick a thematic strategy once. When an asset drifts beyond your ±5% threshold, 1-tap
                    rebalances the entire vault back into perfect alignment.
                  </p>
                  <ul className="space-y-2 text-xs font-mono pt-2">
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        Automatic drift alerts
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        Atomic multi-token swap
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Pillar 3: Smarter */}
                <div
                  className={`rounded-3xl border p-6 space-y-4 transition ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isLight
                        ? 'bg-sky-50 border-sky-200 text-sky-600'
                        : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faRobot} className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Smarter
                  </h3>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Natural language AI thesis engine. Type any macroeconomic strategy to immediately
                    synthesize a balanced, diversified tokenized equity basket.
                  </p>
                  <ul className="space-y-2 text-xs font-mono pt-2">
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        Prompt-to-Portfolio synthesis
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                      />
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        On-chain risk parameters
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Banner Section */}
          <section className="py-16 px-4 sm:px-6">
            <div
              className={`mx-auto max-w-4xl rounded-3xl border p-8 sm:p-12 text-center relative overflow-hidden transition ${
                isLight
                  ? 'bg-white border-slate-200 shadow-xl'
                  : 'bg-gradient-to-b from-[#0E1524] to-[#06080F] border-[#1E293B]'
              }`}
            >
              <div className="relative z-10 space-y-4 max-w-xl mx-auto">
                <StockPilotLogo size={44} showText={true} theme={theme} className="justify-center mb-2" />
                <h2 className={`text-2xl sm:text-3xl font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Ready for 24/7 Autonomous Stock Investing?
                </h2>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Deploy a non-custodial stock portfolio in under 30 seconds on Solana Mainnet.
                </p>
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => setViewMode('app')}
                    className={`inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition active:scale-95 cursor-pointer shadow-xl ${
                      isLight
                        ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                        : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                    }`}
                  >
                    <FontAwesomeIcon icon={faMobileScreen} className="w-5 h-5" />
                    <span>Launch StockPilot App</span>
                    <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Clean Footer */}
          <footer
            className={`border-t py-8 px-4 sm:px-6 text-xs transition-colors ${
              isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#06080F] border-[#1E293B] text-slate-500'
            }`}
          >
            <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <StockPilotLogo size={24} showText={false} theme={theme} />
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  StockPilot
                </span>
                <span>·</span>
                <span>Autonomous Equities on Solana</span>
              </div>
              <div className="flex items-center gap-5">
                <a
                  href="https://explorer.solana.com"
                  target="_blank"
                  rel="noreferrer"
                  className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
                >
                  Solana Explorer
                </a>
                <a
                  href="https://x.com/StockPilotSOL"
                  target="_blank"
                  rel="noreferrer"
                  className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
                  aria-label="Twitter / X (@StockPilotSOL)"
                >
                  <FontAwesomeIcon icon={faXTwitter} className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
                  aria-label="GitHub"
                >
                  <FontAwesomeIcon icon={faGithub} className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
                  aria-label="Discord"
                >
                  <FontAwesomeIcon icon={faDiscord} className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* VIEW MODE 2: DEDICATED ROBO-ADVISOR APP (Clean, Non-Overflowing Mobile-First Shell) */}
      {viewMode === 'app' && (
        <div className="h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden flex justify-center items-center sm:py-3 px-0 sm:px-4 transition-colors relative z-10">
          <div
            className={`w-full max-w-lg h-full flex flex-col border-x sm:border sm:rounded-3xl shadow-2xl relative overflow-hidden transition-colors backdrop-blur-xl ${
              isLight
                ? 'bg-[#F8FAFC]/95 border-slate-200/90 shadow-slate-300/50'
                : 'bg-[#06080F]/95 border-[#1E293B] shadow-2xl shadow-cyan-950/20'
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
        totalValueUsdc={totalValueUsdc}
        onConfirmRebalance={handleConfirmRebalance}
        theme={theme}
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
        }}
        theme={theme}
      />

      <TourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onStartDemo={() => {
          setIsDemoMode(true);
          setActiveTab('portfolio');
        }}
        theme={theme}
      />

      {/* Quick Deposit Modal */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div
            className={`relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl transition-colors ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
                : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-black/80'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Deposit USDC</h3>
              <button
                onClick={() => setIsDepositOpen(false)}
                className={`p-1.5 rounded-lg transition ${
                  isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'
                }`}
              >
                ✕
              </button>
            </div>
            <p className={`text-xs mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              USDC will be automatically allocated according to your {selectedStrategy.name} target
              weights.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className={`w-full rounded-xl border p-3 font-mono text-sm focus:outline-none transition ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-sky-500'
                      : 'bg-[#06080F] border-[#1E293B] text-white focus:border-[#00D2FF]'
                  }`}
                  placeholder="500"
                />
              </div>

              <div className="flex gap-2 text-xs font-mono">
                {['250', '500', '1000', '2500'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt)}
                    className={`flex-1 py-1.5 rounded-lg border transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#101828] border-[#1E293B] text-slate-300 hover:bg-[#162338]'
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDeposit}
                className={`w-full rounded-xl py-3 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                    : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                }`}
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
