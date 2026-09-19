'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faMobileScreen,
  faLock,
  faArrowRight,
  faCheck,
  faShieldHalved,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter, faGithub, faTelegram } from '@fortawesome/free-brands-svg-icons';
import StockPilotLogo from '@/components/StockPilotLogo';

interface LandingViewProps {
  theme: 'dark' | 'light';
  campaignPhrase: string;
  onLaunchApp: () => void;
  renderMockupContent: () => React.ReactNode;
}

export default function LandingView({
  theme,
  campaignPhrase,
  onLaunchApp,
  renderMockupContent,
}: LandingViewProps) {
  const isLight = theme === 'light';

  return (
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
                {campaignPhrase}
              </div>

              {/* Subhead */}
              <p
                className={`text-base max-w-xl leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                The autonomous 24/7 stock robo-advisor built on Solana. Trade tokenized US equities
                without market close, eliminate index drift with atomic Jupiter routing, and hold
                non-custodial PDA vaults on Solana Devnet.
              </p>

              {/* CTA Block */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onLaunchApp()}
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
                  onClick={() => onLaunchApp()}
                  className={`flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      : 'border-[#1E293B] bg-[#0C121E] hover:bg-[#121B2B] text-slate-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Explore Devnet Vault</span>
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
                <span>Non-custodial Anchor PDA vault. Your keys, your stock shares.</span>
              </div>

              {/* 4 Proof Metric Cards */}
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

                {/* Embedded Live Mobile App inside Phone Mockup */}
                <div className="pt-5 overflow-hidden h-[600px] flex flex-col">
                  {renderMockupContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Architecture & Advantage Section (Bento Grid) */}
      <section id="why-stockpilot" className="py-24 px-4 sm:px-6 relative z-10">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2
              className={`text-3xl sm:text-5xl font-extrabold tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Wall Street operates on legacy rails.{' '}
              <span className={isLight ? 'text-sky-600' : 'text-[#00D2FF]'}>
                StockPilot rebuilds it on Solana.
              </span>
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Eliminate brokerage market closures, custodian seizure risk, and high management fees.
              StockPilot continuously executes non-custodial index rebalancing in sub-second Solana slots.
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BENTO CARD 1: TradFi vs StockPilot Direct Comparison Matrix */}
            <div
              className={`lg:col-span-12 rounded-3xl border p-6 sm:p-8 transition-all relative overflow-hidden backdrop-blur-xl ${
                isLight
                  ? 'bg-white/90 border-slate-200 shadow-lg shadow-slate-200/50'
                  : 'bg-[#0A101D]/90 border-[#1E293B] shadow-2xl shadow-cyan-950/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D2FF] font-bold">
                    EXECUTION BENCHMARK
                  </span>
                  <h3 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    TradFi Brokerages vs. StockPilot On-Chain
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Legacy Rails
                  </span>
                  <span className="flex items-center gap-1.5 text-[#00D2FF] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse" />
                    Solana Native
                  </span>
                </div>
              </div>

              {/* Comparison Rows */}
              <div className="mt-6 divide-y divide-slate-200/60 dark:divide-white/5">
                {/* Row 1 */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
                  <div className="md:col-span-3 font-semibold text-slate-400 font-mono uppercase text-[11px]">
                    Market Trading Hours
                  </div>
                  <div className={`md:col-span-4 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    9:30 AM – 4:00 PM EST <span className="text-rose-400/80">(Closed weekends & holidays)</span>
                  </div>
                  <div className="md:col-span-5 font-mono font-bold flex items-center gap-2 text-emerald-400">
                    <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-emerald-400" />
                    <span>24/7/365 Continuous Liquidity · Zero Market Closes</span>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
                  <div className="md:col-span-3 font-semibold text-slate-400 font-mono uppercase text-[11px]">
                    Asset Custody & Keys
                  </div>
                  <div className={`md:col-span-4 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Broker-held street name <span className="text-rose-400/80">(Subject to trading halts & freezes)</span>
                  </div>
                  <div className="md:col-span-5 font-mono font-bold flex items-center gap-2 text-emerald-400">
                    <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-emerald-400" />
                    <span>100% Non-Custodial Anchor PDA Vault (Only you hold keys)</span>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
                  <div className="md:col-span-3 font-semibold text-slate-400 font-mono uppercase text-[11px]">
                    Rebalance Settlement Speed
                  </div>
                  <div className={`md:col-span-4 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    T+1 / T+2 days + manual broker orders
                  </div>
                  <div className="md:col-span-5 font-mono font-bold flex items-center gap-2 text-[#00D2FF]">
                    <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-[#00D2FF]" />
                    <span>&lt; 400ms Sub-Second Atomic Rebalancing</span>
                  </div>
                </div>

                {/* Row 4 */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
                  <div className="md:col-span-3 font-semibold text-slate-400 font-mono uppercase text-[11px]">
                    Management Drag & Fees
                  </div>
                  <div className={`md:col-span-4 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    0.25% – 1.50% AUM annual drag + hidden spreads
                  </div>
                  <div className="md:col-span-5 font-mono font-bold flex items-center gap-2 text-emerald-400">
                    <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-emerald-400" />
                    <span>0.00% Annual AUM Drag · ~$0.0008 Solana Network Gas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO CARD 2: Autonomous Mathematical Drift Engine */}
            <div
              className={`lg:col-span-7 rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all backdrop-blur-xl relative overflow-hidden ${
                isLight
                  ? 'bg-white/90 border-slate-200 shadow-md shadow-slate-200/50'
                  : 'bg-[#0B111C]/90 border-[#1E293B] shadow-xl'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D2FF] font-bold">
                    AUTONOMOUS DRIFT ENGINE
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Real-Time Tracking
                  </span>
                </div>
                <h3 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Dynamic Weight Re-Centering
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  When equities rally or drop, your asset allocations drift away from your target index balance.
                  StockPilot continuously recalculates optimal buy/sell deltas and executes atomic rebalances via Jupiter DEX.
                </p>
              </div>

              {/* Visual Drift Simulation Display */}
              <div className={`mt-6 p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-[#1E293B]'}`}>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-slate-400">Drift Threshold: ±5.0%</span>
                  <span className="text-amber-400 font-bold">+6.2% Drift Detected</span>
                </div>
                <div className="space-y-2.5 font-mono text-[11px]">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>xNVDA (Target: 35.0%)</span>
                      <span className="text-[#00D2FF] font-bold">41.2% (Overweight)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="bg-[#00D2FF] h-full" style={{ width: '35%' }} />
                      <div className="bg-amber-400 h-full animate-pulse" style={{ width: '6.2%' }} />
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800">
                    <span>Action: Trim $62.00 xNVDA ➔ Allocate into xTSM & xAMD</span>
                    <span className="text-emerald-400 font-semibold">1-Tap Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO CARD 3: Real-Time Infrastructure Stack */}
            <div
              className={`lg:col-span-5 rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all backdrop-blur-xl relative overflow-hidden ${
                isLight
                  ? 'bg-white/90 border-slate-200 shadow-md shadow-slate-200/50'
                  : 'bg-[#0B111C]/90 border-[#1E293B] shadow-xl'
              }`}
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D2FF] font-bold">
                  SECURITY ARCHITECTURE
                </span>
                <h3 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Verified DeFi Infrastructure
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Engineered on Solana’s native SVM runtime for institutional reliability and speed.
                </p>
              </div>

              <div className="mt-6 space-y-3 font-mono text-xs">
                <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-white/5'}`}>
                  <div className="flex items-center gap-2.5">
                    <FontAwesomeIcon icon={faShieldHalved} className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Anchor Vault PDA</div>
                      <div className="text-[10px] text-slate-400">Cryptographic isolation per wallet</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                    Non-Custodial
                  </span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-white/5'}`}>
                  <div className="flex items-center gap-2.5">
                    <FontAwesomeIcon icon={faBolt} className="w-4 h-4 text-[#00D2FF]" />
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Pyth Price Oracles</div>
                      <div className="text-[10px] text-slate-400">Sub-second confidence intervals</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#00D2FF]/10 text-[#00D2FF] font-semibold">
                    &lt; 400ms
                  </span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-white/5'}`}>
                  <div className="flex items-center gap-2.5">
                    <FontAwesomeIcon icon={faArrowsRotate} className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Jupiter Ultra Routing</div>
                      <div className="text-[10px] text-slate-400">Best execution across Solana DEXs</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold">
                    Optimized
                  </span>
                </div>
              </div>
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
              Deploy a non-custodial stock portfolio in under 30 seconds on Solana Devnet.
            </p>
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => onLaunchApp()}
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
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
            >
              Solana Explorer (Devnet)
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
              href="https://t.me/+ir8klWwop_5mZjg0"
              target="_blank"
              rel="noreferrer"
              className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
              aria-label="Telegram Community"
            >
              <FontAwesomeIcon icon={faTelegram} className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://github.com/southenempire/stockpilot"
              target="_blank"
              rel="noreferrer"
              className={`transition ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}
              aria-label="GitHub Repository"
            >
              <FontAwesomeIcon icon={faGithub} className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
