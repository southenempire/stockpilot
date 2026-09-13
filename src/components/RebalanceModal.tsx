'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faArrowsRotate,
  faArrowRight,
  faCircleCheck,
  faShieldHalved,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import confetti from 'canvas-confetti';
import { PortfolioHolding } from '@/types/stock';

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: PortfolioHolding[];
  totalValueUsdc: number;
  onConfirmRebalance: () => void;
  theme?: 'dark' | 'light';
}

export default function RebalanceModal({
  isOpen,
  onClose,
  holdings,
  totalValueUsdc,
  onConfirmRebalance,
  theme = 'dark',
}: RebalanceModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState('');

  if (!isOpen) return null;

  const isLight = theme === 'light';

  // Calculate swaps
  const plannedSwaps = holdings
    .map((h) => {
      const targetValue = totalValueUsdc * h.targetWeight;
      const diffUsdc = targetValue - h.currentValue;
      return {
        symbol: h.symbol,
        isBuy: diffUsdc > 0,
        amountUsdc: Math.abs(diffUsdc),
        targetWeight: h.targetWeight,
        currentWeight: h.currentWeight,
      };
    })
    .filter((s) => s.amountUsdc > 0.5);

  const handleExecute = () => {
    setIsExecuting(true);

    setTimeout(() => {
      // Trigger confetti celebration with StockPilot palette
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D2FF', '#38BDF8', '#10B981', '#FFFFFF'],
      });

      const fakeSig = Array.from({ length: 44 }, () =>
        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
      ).join('');

      setTxSignature(fakeSig);
      setIsExecuting(false);
      setTxSuccess(true);

      onConfirmRebalance();
    }, 1200);
  };

  const handleClose = () => {
    setTxSuccess(false);
    setTxSignature('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-3xl border p-6 shadow-2xl transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-black/80'
        }`}
      >
        <button
          onClick={handleClose}
          className={`absolute right-5 top-5 rounded-full p-2 transition-colors ${
            isLight
              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        {txSuccess ? (
          <div className="text-center py-6">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <FontAwesomeIcon icon={faCircleCheck} className="w-9 h-9" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Portfolio Rebalanced</h2>
            <p className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              All tokenized holdings atomically aligned to exact target weights on Solana Mainnet.
            </p>

            <div
              className={`mt-5 rounded-2xl border p-4 text-left ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-[#1E293B]'
              }`}
            >
              <div className={`text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Solana Transaction Signature:
              </div>
              <div
                className={`mt-1 font-mono text-xs break-all ${
                  isLight ? 'text-sky-700 font-semibold' : 'text-[#00D2FF]'
                }`}
              >
                {txSignature}
              </div>
              <div
                className={`mt-2 flex items-center justify-between text-[11px] border-t pt-2 ${
                  isLight ? 'border-slate-200 text-slate-500' : 'border-white/[0.06] text-slate-400'
                }`}
              >
                <span>Cluster: Solana Mainnet-Beta</span>
                <span className={`font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                  Finalized (380ms)
                </span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className={`mt-6 w-full rounded-xl py-3 text-xs font-bold transition active:scale-95 cursor-pointer ${
                isLight
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8]'
              }`}
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  isLight
                    ? 'bg-sky-50 border-sky-200 text-sky-600'
                    : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
                }`}
              >
                <FontAwesomeIcon icon={faArrowsRotate} className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Execute On-Chain Rebalance</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Atomic multi-swap bundle to eliminate drift
                </p>
              </div>
            </div>

            {/* Swaps preview */}
            <div className="mt-5 space-y-2 max-h-60 overflow-y-auto pr-1">
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider font-mono ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Planned Atomic Swaps:
              </div>
              {plannedSwaps.length === 0 ? (
                <div
                  className={`rounded-xl border p-4 text-center text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-[#101828] border-[#1E293B] text-slate-400'
                  }`}
                >
                  Portfolio is already balanced at target weights!
                </div>
              ) : (
                plannedSwaps.map((s) => (
                  <div
                    key={s.symbol}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                      isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-[#06080F] border-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{s.symbol}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          s.isBuy
                            ? isLight
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-sky-500/10 text-[#00D2FF] border border-sky-500/20'
                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}
                      >
                        {s.isBuy ? 'BUY' : 'TRIM'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                        ${s.amountUsdc.toFixed(2)} USDC
                      </span>
                      <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold">
                        {(s.targetWeight * 100).toFixed(0)}% Target
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mechanics info */}
            <div
              className={`mt-5 rounded-2xl border p-3.5 space-y-2 text-xs ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-[#1E293B]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FontAwesomeIcon
                    icon={faShieldHalved}
                    className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-[#00D2FF]'}`}
                  />
                  <span>Execution Program:</span>
                </span>
                <span className="font-mono font-semibold">StockPilot Vault PDA</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-[#00D2FF]" />
                  <span>Estimated Solana Gas:</span>
                </span>
                <span
                  className={`font-mono font-semibold ${
                    isLight ? 'text-emerald-600' : 'text-emerald-400'
                  }`}
                >
                  &lt; $0.0008
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Routing Engine:</span>
                <span className="font-semibold">Zero Slippage Atomic Swap</span>
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 border-slate-200/50 dark:border-white/5">
                <span>Protocol Fee (0.15%):</span>
                <span className="font-mono text-[#00D2FF] font-semibold">
                  ${(totalValueUsdc * 0.0015).toFixed(2)} USDC
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleClose}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  isLight
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting || plannedSwaps.length === 0}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg ${
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                    : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                }`}
              >
                <FontAwesomeIcon
                  icon={faArrowsRotate}
                  className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`}
                />
                <span>{isExecuting ? 'Broadcasting to Solana...' : 'Confirm 1-Tap Rebalance'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
