'use client';

import React from 'react';
import { PortfolioHolding } from '@/types/stock';
import { AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';

interface DriftVisualizerProps {
  holdings: PortfolioHolding[];
  autopilotEnabled: boolean;
  onToggleAutopilot: () => void;
  onOpenRebalanceModal: () => void;
  cooldownActive: boolean;
  cooldownSeconds: number;
}

export default function DriftVisualizer({
  holdings,
  autopilotEnabled,
  onToggleAutopilot,
  onOpenRebalanceModal,
  cooldownActive,
  cooldownSeconds
}: DriftVisualizerProps) {
  // Check if any holding has drifted beyond 5%
  const driftedHoldings = holdings.filter((h) => Math.abs(h.driftPercent) >= 5.0);
  const hasSignificantDrift = driftedHoldings.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12131C] p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Portfolio Drift & Rebalance Engine</h3>
            {hasSignificantDrift ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                <span>Drift Alert ({driftedHoldings.length} assets)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Optimally Balanced</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitors real-time equity drift against target index allocations.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* 24/7 Autopilot Toggle */}
          <button
            onClick={onToggleAutopilot}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              autopilotEnabled
                ? 'bg-[#14F195]/10 border-[#14F195]/40 text-[#14F195]'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${autopilotEnabled ? 'text-[#14F195] fill-[#14F195]' : ''}`} />
            <span>Autopilot: {autopilotEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* 1-Tap Rebalance Button */}
          <button
            onClick={onOpenRebalanceModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] px-3.5 py-1.5 text-xs font-bold text-black shadow-md shadow-[#14F195]/20 hover:opacity-95 active:scale-95 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>1-Tap Rebalance</span>
          </button>
        </div>
      </div>

      {/* Drift Comparison Bars */}
      <div className="mt-5 space-y-3">
        {holdings.map((h) => {
          const isOver = h.driftPercent > 0;
          const isDriftHigh = Math.abs(h.driftPercent) >= 5.0;

          return (
            <div key={h.symbol} className="rounded-xl bg-[#090A0F]/60 border border-white/5 p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{h.symbol}</span>
                  <span className="text-zinc-400 text-[11px] hidden sm:inline">{h.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-zinc-400 text-[11px]">Target: </span>
                    <span className="font-mono text-zinc-200 font-semibold">{(h.targetWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-400 text-[11px]">Current: </span>
                    <span className="font-mono text-white font-bold">{(h.currentWeight * 100).toFixed(1)}%</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${
                      isDriftHigh
                        ? isOver
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-white/5 text-zinc-400 border-white/5'
                    }`}
                  >
                    {isOver ? `+${h.driftPercent}%` : `${h.driftPercent}%`}
                  </span>
                </div>
              </div>

              {/* Progress track */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                  style={{ left: `${h.targetWeight * 100}%` }}
                />
                {/* Current weight bar */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDriftHigh
                      ? isOver
                        ? 'bg-emerald-400'
                        : 'bg-rose-400'
                      : 'bg-[#14F195]'
                  }`}
                  style={{ width: `${Math.min(100, h.currentWeight * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {cooldownActive && (
        <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-2.5 text-center text-xs text-zinc-400">
          ⏱️ Timelock active: Next automated on-chain rebalance cooldown in <span className="font-mono font-bold text-white">{cooldownSeconds}s</span> (Solana Clock sysvar).
        </div>
      )}
    </div>
  );
}
