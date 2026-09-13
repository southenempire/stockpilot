'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faShareNodes,
  faCheck,
  faArrowTrendUp,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { PortfolioHolding } from '@/types/stock';
import StockPilotLogo from './StockPilotLogo';

interface SocialFlexCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyName: string;
  totalValueUsdc: number;
  pnlPercent: number;
  holdings: PortfolioHolding[];
  theme?: 'dark' | 'light';
}

export default function SocialFlexCardModal({
  isOpen,
  onClose,
  strategyName,
  totalValueUsdc,
  pnlPercent,
  holdings,
  theme = 'dark',
}: SocialFlexCardModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const shareText = `Managing my autonomous tokenized stock index "${strategyName}" 24/7 on @solana Mainnet with @StockPilotSOL! ⚡\n\nReturn: +${pnlPercent}% • <$0.001 gas • Zero market close 📈\n\nAutomate your portfolio on Solana:`;

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-black/80'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute right-4 top-4 rounded-full p-2 transition-colors ${
            isLight
              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div
            className={`text-xs font-bold uppercase tracking-wider font-mono ${
              isLight ? 'text-sky-600' : 'text-[#00D2FF]'
            }`}
          >
            Proof of Alpha
          </div>
          <h3 className="text-base font-bold">Share Your Performance</h3>
        </div>

        {/* The Mobile Card Preview */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-b from-[#101A2C] to-[#06080F] p-5 shadow-2xl text-slate-100">
          {/* Card Brand Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-[#1E293B] pb-3">
            <StockPilotLogo size={28} showText={true} theme="dark" />
            <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[9px] font-bold text-[#00D2FF] font-mono">
              MAINNET
            </span>
          </div>

          {/* Strategy & Alpha Return */}
          <div className="relative z-10 mt-4">
            <div className="text-[11px] font-medium text-slate-400">Autonomous Index:</div>
            <div className="text-base font-bold text-slate-100 tracking-tight">{strategyName}</div>

            <div className="mt-3 rounded-xl bg-[#06080F] border border-[#1E293B] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-slate-500 font-mono">Total Value</div>
                <div className="text-base font-extrabold font-mono text-slate-100">
                  ${totalValueUsdc.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-slate-500 font-mono">Autopilot Gain</div>
                <div className="flex items-center gap-1.5 text-base font-extrabold font-mono text-emerald-400">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="w-4 h-4" />
                  <span>+{pnlPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Allocation Chips */}
          <div className="relative z-10 mt-3.5">
            <div className="text-[10px] font-medium text-slate-400 mb-1.5 font-mono">
              Top Tokenized Holdings:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {holdings.slice(0, 4).map((h) => (
                <div
                  key={h.symbol}
                  className="flex items-center justify-between rounded-lg bg-[#0C121E] border border-[#1E293B] px-2 py-1 text-[10px] font-mono"
                >
                  <span className="font-semibold text-slate-200">{h.symbol}</span>
                  <span className="text-[#00D2FF] font-bold">
                    {(h.targetWeight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card Footer */}
          <div className="relative z-10 mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>24/7 Equities on Solana</span>
            <span className="text-slate-300 font-semibold">stockpilot.trade</span>
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={handleShareTwitter}
            className="flex items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-xs font-bold text-white hover:bg-slate-900 active:scale-95 transition cursor-pointer border border-white/20"
          >
            <FontAwesomeIcon icon={faXTwitter} className="w-3.5 h-3.5" />
            <span>Post on X</span>
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 cursor-pointer ${
              isLight
                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                : 'bg-[#151E2E] text-slate-200 hover:bg-[#1E2B40]'
            }`}
          >
            <FontAwesomeIcon
              icon={copied ? faCheck : faShareNodes}
              className={`w-3.5 h-3.5 ${copied ? 'text-emerald-500' : ''}`}
            />
            <span>{copied ? 'Copied' : 'Copy Post'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
