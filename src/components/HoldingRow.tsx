'use client';

import React from 'react';
import { PortfolioHolding } from '@/types/stock';
import { SUPPORTED_STOCKS } from '@/data/stocks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowTrendUp,
  faArrowTrendDown,
  faCircleCheck,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';

interface HoldingRowProps {
  holding: PortfolioHolding;
  driftTolerance?: number;
  theme?: 'dark' | 'light';
  compact?: boolean;
  onBuy?: (holding: PortfolioHolding) => void;
}

export default function HoldingRow({
  holding,
  driftTolerance = 5.0,
  theme = 'dark',
  compact = false,
  onBuy,
}: HoldingRowProps) {
  const stock = SUPPORTED_STOCKS[holding.symbol];
  const isPositive = holding.change24h >= 0;
  const isOver = holding.driftPercent > 0;
  const isDriftHigh = Math.abs(holding.driftPercent) >= driftTolerance;
  const isLight = theme === 'light';

  if (compact) {
    return (
      <div
        className={`rounded-xl border p-3 transition-all ${
          isLight
            ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
            : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155]'
        }`}
      >
        {/* Top: Identity & Price */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-white text-[10px] shadow-sm"
              style={{ backgroundColor: stock?.iconBg || '#1E293B' }}
            >
              {holding.symbol.replace('x', '')}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {holding.symbol}
                </span>
                <span className={`text-[8px] font-mono uppercase px-1 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                  {stock?.category || 'Equity'}
                </span>
              </div>
              <div className={`text-[10px] truncate max-w-[90px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {holding.name}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              ${holding.currentPrice.toFixed(2)}
            </div>
            <div className={`text-[10px] font-mono font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? `+${holding.change24h}%` : `${holding.change24h}%`}
            </div>
          </div>
        </div>

        {/* Bottom: Progress & Value & Drift */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
          <div className="flex-1 max-w-[130px] space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>{(holding.currentWeight * 100).toFixed(0)}% act</span>
              <span>{(holding.targetWeight * 100).toFixed(0)}% tgt</span>
            </div>
            <div className={`relative h-1 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-[#151E2E]'}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isDriftHigh ? (isOver ? 'bg-amber-400' : 'bg-rose-400') : 'bg-[#00D2FF]'
                }`}
                style={{ width: `${Math.min(holding.currentWeight * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                ${holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <span
              className={`font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                isDriftHigh
                  ? isOver
                    ? isLight
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : isLight
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {isDriftHigh ? (isOver ? `+${holding.driftPercent}%` : `${holding.driftPercent}%`) : 'OK'}
            </span>

            {onBuy && (
              <button
                type="button"
                onClick={() => onBuy(holding)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                    : 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/30 hover:bg-[#00D2FF]/20'
                }`}
              >
                + Buy
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border p-4 transition-all duration-200 gap-3 ${
        isLight
          ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-sm'
          : 'bg-[#0B111C] border-[#1E293B] hover:border-[#334155] hover:bg-[#101828]'
      }`}
    >
      {/* Left: Stock Logo & Identity */}
      <div className="flex items-center gap-3 min-w-[190px]">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white text-xs shadow-sm border border-white/10 group-hover:scale-105 transition-transform"
          style={{ backgroundColor: stock?.iconBg || '#1E293B' }}
        >
          {holding.symbol.replace('x', '')}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono font-bold text-sm tracking-tight ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              {holding.symbol}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                isLight
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : 'bg-white/[0.05] text-slate-400 border border-white/5'
              }`}
            >
              {stock?.category || 'Equity'}
            </span>
          </div>
          <div
            className={`text-xs font-medium truncate max-w-[140px] sm:max-w-none ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {holding.name}
          </div>
        </div>
      </div>

      {/* Middle-Left: Live Price & 24h Performance */}
      <div className="flex sm:flex-col items-baseline sm:items-start justify-between sm:justify-center min-w-[110px]">
        <div
          className={`font-mono font-bold text-sm ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          ${holding.currentPrice.toFixed(2)}
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isPositive
              ? isLight
                ? 'text-emerald-600'
                : 'text-emerald-400'
              : 'text-rose-500'
          }`}
        >
          <FontAwesomeIcon
            icon={isPositive ? faArrowTrendUp : faArrowTrendDown}
            className="w-3 h-3"
          />
          <span>{isPositive ? `+${holding.change24h}%` : `${holding.change24h}%`}</span>
          <span className={isLight ? 'text-slate-400 text-[10px]' : 'text-slate-500 text-[10px]'}>
            24h
          </span>
        </div>
      </div>

      {/* Middle-Right: Allocation Meter (Current vs Target) */}
      <div className="w-full sm:w-44 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span
            className={`font-semibold text-[11px] ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            {(holding.currentWeight * 100).toFixed(1)}%{' '}
            <span className={isLight ? 'text-slate-400 font-normal' : 'text-slate-500 font-normal'}>
              actual
            </span>
          </span>
          <span
            className={`text-[11px] ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Target {(holding.targetWeight * 100).toFixed(0)}%
          </span>
        </div>
        {/* Progress meter */}
        <div
          className={`relative h-1.5 w-full rounded-full overflow-hidden ${
            isLight ? 'bg-slate-200' : 'bg-[#151E2E]'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDriftHigh
                ? isOver
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
                : 'bg-[#00D2FF]'
            }`}
            style={{ width: `${Math.min(holding.currentWeight * 100, 100)}%` }}
          />
          {/* Target marker line */}
          <div
            className={`absolute top-0 bottom-0 w-0.5 shadow-sm rounded-full -translate-x-1/2 ${
              isLight ? 'bg-slate-700' : 'bg-white'
            }`}
            style={{ left: `${holding.targetWeight * 100}%` }}
            title={`Target: ${(holding.targetWeight * 100).toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Right: Position Value, Shares & Drift Status */}
      <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[130px]">
        <div className="text-right">
          <div
            className={`font-mono font-bold text-sm ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            ${holding.currentValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            className={`font-mono text-[11px] ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {holding.shares.toFixed(3)} shares
          </div>
        </div>

        {/* Drift Badge */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
              isDriftHigh
                ? isOver
                  ? isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : isLight
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {isDriftHigh ? (
              <>
                <FontAwesomeIcon icon={faCircleExclamation} className="w-3 h-3" />
                <span>{isOver ? `+${holding.driftPercent}%` : `${holding.driftPercent}%`}</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className={`w-3 h-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                />
                <span>Aligned</span>
              </>
            )}
          </span>

          {onBuy && (
            <button
              type="button"
              onClick={() => onBuy(holding)}
              className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                isLight
                  ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                  : 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/30 hover:bg-[#00D2FF]/20'
              }`}
            >
              + Buy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
