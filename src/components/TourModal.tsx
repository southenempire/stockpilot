'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faArrowRight,
  faArrowLeft,
  faShieldHalved,
  faArrowsRotate,
  faWandMagicSparkles,
  faBolt,
  faCompass,
  faLayerGroup,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDemo?: () => void;
  onConnectWallet?: () => void;
  theme?: 'dark' | 'light';
}

const TOUR_STEPS = [
  {
    step: 1,
    tag: 'WELCOME PILOT',
    title: 'The Stock Market Solana Runs On',
    description:
      'StockPilot is an autonomous, non-custodial robo-advisor on Solana. Invest in tokenized US equities (NVDA, TSM, AMD, MSFT, AAPL) 24/7 with zero market close, no brokers, and sub-cent transaction fees.',
    badge: '24/7 Liquidity',
    icon: faBolt,
    accentColor: '#00D2FF',
  },
  {
    step: 2,
    tag: 'SECURITY ARCHITECTURE',
    title: '100% Non-Custodial Anchor Vaults',
    description:
      'Your funds never touch a centralized exchange or custodian. Every user has a personal Anchor Program Derived Address (PDA) on-chain. Only your wallet private key can ever deposit, rebalance, or withdraw funds.',
    badge: 'Anchor PDA Vault',
    icon: faShieldHalved,
    accentColor: '#10B981',
  },
  {
    step: 3,
    tag: 'AUTOMATION ENGINE',
    title: 'Smart Drift Rebalancing via Pyth',
    description:
      'Live Pyth Network oracles monitor equity price fluctuations in real time. When market moves cause your portfolio to drift from your target weights, rebalance your entire basket in 1 single click with <$0.001 gas.',
    badge: 'Pyth Oracles · Jupiter DEX',
    icon: faArrowsRotate,
    accentColor: '#38BDF8',
  },
  {
    step: 4,
    tag: 'AI STRATEGY GENERATOR',
    title: 'Natural Language Index Baskets',
    description:
      'Pick from institutional-grade prebuilt indices (AI Compute, Mag 7, Green Tech) or type any investment thesis (e.g. "quantum computing chips" or "clean energy supply chain") to have AI curate your custom basket.',
    badge: 'AI Prompt Builder',
    icon: faWandMagicSparkles,
    accentColor: '#A78BFA',
  },
  {
    step: 5,
    tag: 'READY FOR LAUNCH',
    title: 'Connect & Automate on Devnet',
    description:
      'Connect your Solana wallet to manage non-custodial Anchor PDA vaults, claim Devnet test tokens from the faucet, and automate algorithmic equity rebalancing 24/7.',
    badge: 'Devnet Live',
    icon: faCompass,
    accentColor: '#00D2FF',
  },
];

export default function TourModal({
  isOpen,
  onClose,
  onStartDemo,
  onConnectWallet,
  theme = 'dark',
}: TourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset to first slide whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const stepData = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('stockpilot_tour_dismissed', 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all flex flex-col ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-cyan-950/40'
        }`}
      >
        {/* Top Decorative Background Banner with Mascot & Cyan Glow */}
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-b from-[#06080F] to-[#0E1524] border-b border-[#1E293B]">
          {/* Cyber City & Warrior Image */}
          <div className="absolute right-0 top-0 bottom-0 w-48 pointer-events-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/anime-warrior.jpg"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top',
                opacity: 0.6,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06080F] via-[#06080F]/60 to-transparent" />
          </div>

          {/* Cyan Glow Accent */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00D2FF]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleComplete}
            className="absolute right-4 top-4 z-20 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            aria-label="Close tour"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>

          {/* Badge & Step Counter */}
          <div className="absolute left-6 bottom-5 z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#00D2FF]/15 text-[#00D2FF] border border-[#00D2FF]/30">
                {stepData.tag}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <span>{stepData.badge}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border shrink-0 transition-colors"
              style={{
                backgroundColor: `${stepData.accentColor}15`,
                borderColor: `${stepData.accentColor}30`,
                color: stepData.accentColor,
              }}
            >
              <FontAwesomeIcon icon={stepData.icon} className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight">{stepData.title}</h2>
              <p
                className={`text-xs leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {stepData.description}
              </p>
            </div>
          </div>

          {/* Progress Indicators (Dots) */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentStep === idx
                    ? 'w-6 bg-[#00D2FF]'
                    : isLight
                    ? 'w-1.5 bg-slate-200 hover:bg-slate-300'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between gap-3">
            {currentStep > 0 ? (
              <button
                onClick={handlePrev}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
                <span>Back</span>
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="text-xs text-slate-500 hover:text-slate-400 font-mono transition cursor-pointer px-2"
              >
                Skip Tour
              </button>
            )}

            <div className="flex items-center gap-2">
              {isLast && onStartDemo && (
                <button
                  onClick={() => {
                    handleComplete();
                    onStartDemo();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faBolt} className="w-3 h-3" />
                  <span>Try $10K Demo</span>
                </button>
              )}

              <button
                onClick={handleNext}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                    : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                }`}
              >
                <span>{isLast ? 'Enter StockPilot' : 'Next'}</span>
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
