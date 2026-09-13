'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
  className?: string;
  compact?: boolean;
}

export default function ThemeToggle({
  theme,
  onToggle,
  className = '',
  compact = false,
}: ThemeToggleProps) {
  const isLight = theme === 'light';

  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      className={`inline-flex items-center gap-2 rounded-xl border transition-all duration-200 cursor-pointer ${
        compact ? 'p-2' : 'px-3 py-1.5'
      } ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
          : 'bg-[#0D1117] border-[#1C2530] text-slate-300 hover:bg-[#161F2E] hover:text-white'
      } ${className}`}
    >
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
          isLight ? 'text-amber-500' : 'text-[#C7F284]'
        }`}
      >
        <FontAwesomeIcon icon={isLight ? faSun : faMoon} className="w-4 h-4" />
      </div>
      {!compact && (
        <span className="text-xs font-semibold capitalize font-mono">
          {isLight ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
