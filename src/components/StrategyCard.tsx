'use client';

import React from 'react';
import { BasketStrategy } from '@/types/stock';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrochip,
  faCrown,
  faShieldHalved,
  faBolt,
  faWandMagicSparkles,
  faRobot,
  faArrowTrendUp,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

interface StrategyCardProps {
  strategy: BasketStrategy;
  isSelected: boolean;
  onSelect: (strategy: BasketStrategy) => void;
  onBuy?: (strategy: BasketStrategy) => void;
  theme?: 'dark' | 'light';
}

const FA_ICON_MAP: Record<string, IconDefinition> = {
  Cpu: faMicrochip,
  Crown: faCrown,
  ShieldCheck: faShieldHalved,
  Zap: faBolt,
  Sparkles: faWandMagicSparkles,
  Bot: faRobot,
};

export default function StrategyCard({
  strategy,
  isSelected,
  onSelect,
  onBuy,
  theme = 'dark',
}: StrategyCardProps) {
  const iconDef = FA_ICON_MAP[strategy.icon] || faWandMagicSparkles;
  const isLight = theme === 'light';

  const riskBadgeColor = {
    Conservative: isLight
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Balanced: isLight
      ? 'bg-sky-50 text-sky-700 border-sky-300'
      : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    Aggressive: isLight
      ? 'bg-amber-50 text-amber-700 border-amber-300'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }[strategy.riskTier];

  return (
    <div
      onClick={() => onSelect(strategy)}
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer ${
        isSelected
          ? isLight
            ? 'border-sky-600 bg-sky-50/50 shadow-md shadow-sky-500/10'
            : 'border-[#00D2FF] bg-[#00D2FF]/5 shadow-xl shadow-[#00D2FF]/10'
          : isLight
          ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-sm'
          : 'border-[#1E293B] bg-[#0B111C] hover:border-[#334155] hover:bg-[#101828]'
      }`}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl border group-hover:scale-105 transition ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-sky-600'
                : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
            }`}
          >
            <FontAwesomeIcon icon={iconDef} className="w-5 h-5" />
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${riskBadgeColor}`}>
            {strategy.riskTier}
          </span>
        </div>

        <h3
          className={`mt-4 text-base font-bold transition ${
            isLight
              ? 'text-slate-900 group-hover:text-sky-600'
              : 'text-slate-100 group-hover:text-[#00D2FF]'
          }`}
        >
          {strategy.name}
        </h3>
        <p className={`mt-1 text-xs line-clamp-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {strategy.tagline}
        </p>
      </div>

      {/* Target Stock Allocation Tags */}
      <div className="mt-5">
        <div className={`text-[11px] font-medium mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Target Basket Allocation:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {strategy.tokens.map((t) => (
            <span
              key={t.symbol}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono ${
                isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-black/30 border-[#1E293B] text-slate-200'
              }`}
            >
              <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {t.symbol}
              </span>
              <span
                className={`font-bold ${isLight ? 'text-sky-600' : 'text-[#00D2FF]'}`}
              >
                {(t.targetWeight * 100).toFixed(0)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Footer Metrics */}
      <div
        className={`mt-5 border-t pt-4 flex items-center justify-between ${
          isLight ? 'border-slate-200' : 'border-[#1E293B]'
        }`}
      >
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium font-mono">
            Hist. CAGR
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              isLight ? 'text-emerald-600' : 'text-emerald-400'
            }`}
          >
            {strategy.expectedAnnualReturn}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBuy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBuy(strategy);
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                isLight
                  ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                  : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
              }`}
            >
              <span>Buy Basket</span>
              <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(strategy);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              isSelected
                ? isLight
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white/20 text-white font-bold'
                : isLight
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            <span>{isSelected ? 'Active' : 'Select'}</span>
            <FontAwesomeIcon icon={faArrowTrendUp} className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
