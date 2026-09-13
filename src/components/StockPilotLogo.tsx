'use client';

import React from 'react';

interface StockPilotLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export default function StockPilotLogo({
  size = 36,
  showText = true,
  className = '',
  theme = 'dark',
}: StockPilotLogoProps) {
  const isLight = theme === 'light';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Aerotech Falcon Brand Mark SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_0_12px_rgba(0,210,255,0.3)]"
      >
        <rect
          width="48"
          height="48"
          rx="12"
          fill={isLight ? '#F1F5F9' : '#0B111C'}
          stroke={isLight ? '#CBD5E1' : '#1E293B'}
          strokeWidth="1.5"
        />
        {/* Supersonic Flight Line / Upward Stock Trend */}
        <path
          d="M12 29L18 20L23 26L33 13L35 18"
          stroke="url(#stockpilot-aero-grad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Upper Stealth Wing */}
        <path
          d="M13 21L19 15L27 15"
          stroke="#38BDF8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Trend Arrowhead */}
        <path
          d="M27 13H33V19"
          stroke="#00D2FF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Stabilizer Fin */}
        <path
          d="M16 32L22 35L27 30"
          stroke="#00D2FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <defs>
          <linearGradient id="stockpilot-aero-grad" x1="12" y1="29" x2="33" y2="13" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0284C7" />
            <stop offset="0.5" stopColor="#00D2FF" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-base sm:text-lg">
              <span className={isLight ? 'text-slate-900' : 'text-white'}>STOCK</span>
              <span className="text-[#00D2FF] drop-shadow-[0_0_8px_rgba(0,210,255,0.4)]">PILOT</span>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-500/10 text-[#00D2FF] border border-sky-500/20 font-bold">
              SOLANA
            </span>
          </div>
          <span className={`text-[9px] tracking-wider uppercase font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Autonomous Equities
          </span>
        </div>
      )}
    </div>
  );
}
