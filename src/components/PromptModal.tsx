'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faWandMagicSparkles,
  faArrowRight,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';
import { generateAiStrategy } from '@/lib/ai/strategy-generator';
import { BasketStrategy } from '@/types/stock';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStrategy: (strat: BasketStrategy) => void;
  theme?: 'dark' | 'light';
}

const EXAMPLE_PROMPTS = [
  'Aggressive semiconductor & AI chip infrastructure index',
  'Conservative dividend aristocrats with low volatility',
  'High-beta autonomous robotics & crypto nexus',
  'Balanced S&P megacap tech portfolio',
];

export default function PromptModal({
  isOpen,
  onClose,
  onSelectStrategy,
  theme = 'dark',
}: PromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    setTimeout(() => {
      const newStrategy = generateAiStrategy(prompt);
      setIsGenerating(false);
      onSelectStrategy(newStrategy);
      onClose();
    }, 800);
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
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute right-5 top-5 rounded-full p-2 transition-colors ${
            isLight
              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
              isLight
                ? 'bg-sky-50 border-sky-200 text-sky-600'
                : 'bg-sky-500/10 border-sky-500/20 text-[#00D2FF]'
            }`}
          >
            <FontAwesomeIcon icon={faRobot} className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Strategy Copilot</h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Describe your thesis &rarr; generate an autonomous stock index
            </p>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mt-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., I want an aggressive basket heavy on Nvidia and chipmakers with a 20% defensive buffer..."
            rows={3}
            className={`w-full rounded-2xl border p-4 text-sm focus:outline-none transition ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white'
                : 'bg-[#06080F] border-[#1E293B] text-slate-100 placeholder-slate-500 focus:border-[#00D2FF]'
            }`}
          />
        </div>

        {/* Quick Presets */}
        <div className="mt-4">
          <div
            className={`text-[11px] font-semibold mb-2 font-mono ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Try an example thesis:
          </div>
          <div className="flex flex-col gap-1.5">
            {EXAMPLE_PROMPTS.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(ex)}
                className={`text-left rounded-xl border px-3.5 py-2 text-xs transition flex items-center justify-between group cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    : 'bg-[#101828] border-[#1E293B] text-slate-300 hover:bg-[#152136] hover:border-[#334155]'
                }`}
              >
                <span>{ex}</span>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className={`w-3 h-3 text-slate-400 group-hover:${
                    isLight ? 'text-sky-600' : 'text-[#00D2FF]'
                  } transition`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
              isLight
                ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg ${
              isLight
                ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
            }`}
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Synthesizing Weights...' : 'Generate AI Basket'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
