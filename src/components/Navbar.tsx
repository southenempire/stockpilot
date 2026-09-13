'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Bot, Sparkles, Activity, ShieldCheck, Wallet } from 'lucide-react';

// Dynamic import for WalletMultiButton to prevent SSR hydration mismatch
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface NavbarProps {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  demoBalanceUsdc: number;
  onOpenPromptModal: () => void;
}

export default function Navbar({
  isDemoMode,
  setIsDemoMode,
  demoBalanceUsdc,
  onOpenPromptModal
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090A0F]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-0.5 shadow-lg shadow-[#14F195]/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#090A0F]">
              <Bot className="h-5 w-5 text-[#14F195]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white">Stock<span className="text-[#14F195]">Pilot</span></span>
              <span className="rounded-full bg-[#9945FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#9945FF] border border-[#9945FF]/30">
                Solana
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14F195] animate-pulse"></span>
              <span className="font-medium text-[#14F195]">24/7 Market Live</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Strategy Prompt Button */}
          <button
            onClick={onOpenPromptModal}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:border-[#9945FF]/50 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#9945FF]" />
            <span>AI Basket Creator</span>
          </button>

          {/* Demo Mode / Live Mode Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12131C] px-2.5 py-1.5">
            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition ${
                isDemoMode
                  ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{isDemoMode ? 'Demo Pilot' : 'Live Devnet'}</span>
            </button>
            {isDemoMode && (
              <span className="font-mono text-xs font-bold text-white pl-1 border-l border-white/10">
                ${demoBalanceUsdc.toLocaleString()} USDC
              </span>
            )}
          </div>

          {/* Solana Wallet Button */}
          <div className="stockpilot-wallet-btn">
            <WalletMultiButton style={{
              backgroundColor: '#9945FF',
              borderRadius: '0.75rem',
              height: '38px',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: 'inherit'
            }} />
          </div>
        </div>
      </div>
    </header>
  );
}
