'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faDownload,
  faPalette,
  faCopy,
  faCheck,
  faCircleCheck,
  faShieldHalved,
  faLayerGroup,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons';
import StockPilotLogo from './StockPilotLogo';

interface BrandKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

const BRAND_COLORS = [
  { name: 'Jupiter Chartreuse', hex: '#C7F284', role: 'Primary Accent & Action', textDark: true },
  { name: 'Electric Cyan', hex: '#00BEF0', role: 'Secondary Signal & Tech', textDark: false },
  { name: 'Obsidian Matte', hex: '#080B0F', role: 'Dark Surface Canvas', textDark: false },
  { name: 'Deep Slate', hex: '#0D1117', role: 'Card & Container Surface', textDark: false },
  { name: 'Hairline Border', hex: '#1C2530', role: 'Subtle Structural Grid', textDark: false },
  { name: 'Pure Frost', hex: '#F8FAFC', role: 'High-Contrast Typography', textDark: true },
];

export default function BrandKitModal({ isOpen, onClose, theme = 'dark' }: BrandKitModalProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0D1117] border-[#1C2530] text-slate-100 shadow-black/80'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isLight
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-[#161F2E]'
          }`}
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#C7F284]/15 border border-[#C7F284]/30 flex items-center justify-center text-[#C7F284]">
            <FontAwesomeIcon icon={faPalette} className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">StockPilot Brand Kit</h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Official design assets, vector typography, and color tokens
            </p>
          </div>
        </div>

        {/* Logo Preview Cards */}
        <div className="mb-8">
          <h3 className={`text-xs font-mono uppercase tracking-wider mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Official Brand Mark
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark Variant */}
            <div className="p-6 rounded-xl bg-[#080B0F] border border-[#1C2530] flex flex-col items-center justify-center gap-4 text-center">
              <StockPilotLogo size={48} theme="dark" />
              <span className="text-[11px] font-mono text-slate-400">Dark Matte Canvas</span>
              <a
                href="/stockpilot_logo.jpg"
                download="stockpilot_logo_master.jpg"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#C7F284] text-[#080B0F] text-xs font-bold hover:bg-[#b8e472] transition-colors"
              >
                <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5" />
                Download Master Asset
              </a>
            </div>

            {/* Light Variant */}
            <div className="p-6 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center gap-4 text-center">
              <StockPilotLogo size={48} theme="light" />
              <span className="text-[11px] font-mono text-slate-600">Light High-Contrast</span>
              <button
                onClick={() => {
                  const svgData = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#0D1117" stroke="#1C2530" stroke-width="1.5"/><path d="M13 28L18 20L23 27L33 13L35 19" stroke="#00BEF0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 21L19 15L27 15" stroke="#00BEF0" stroke-width="2.4" stroke-linecap="round"/><path d="M27 13H33V19" stroke="#C7F284" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 31L23 34L28 29" stroke="#C7F284" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/></svg>`;
                  const blob = new Blob([svgData], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'stockpilot_mark.svg';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5" />
                Export Vector SVG
              </button>
            </div>
          </div>
        </div>

        {/* Color Palette Grid */}
        <div className="mb-8">
          <h3 className={`text-xs font-mono uppercase tracking-wider mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Design System Color Tokens
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BRAND_COLORS.map((c) => (
              <div
                key={c.hex}
                onClick={() => copyHex(c.hex)}
                className={`p-3 rounded-xl border cursor-pointer group transition-transform hover:scale-[1.02] ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1C2530] bg-[#0A0E14]'
                }`}
              >
                <div
                  className="w-full h-10 rounded-lg mb-2 shadow-inner border border-black/10 flex items-center justify-center font-mono text-[11px] font-bold"
                  style={{ backgroundColor: c.hex, color: c.textDark ? '#080B0F' : '#F8FAFC' }}
                >
                  {c.hex}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {c.name}
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {c.role}
                    </div>
                  </div>
                  <span className="text-slate-400 group-hover:text-[#C7F284] text-xs">
                    {copiedHex === c.hex ? (
                      <FontAwesomeIcon icon={faCheck} className="text-[#C7F284]" />
                    ) : (
                      <FontAwesomeIcon icon={faCopy} />
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture & Typography Specs */}
        <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#0A0E14] border-[#1C2530] text-slate-300'
        }`}>
          <div className="flex items-center gap-2 font-semibold text-[#C7F284]">
            <FontAwesomeIcon icon={faCircleCheck} />
            <span>Design Guiding Principle</span>
          </div>
          <p>
            StockPilot merges the lightning execution of Jupiter DEX with Wealthfront-style autonomous robo-advisory. 
            All typography defaults to system sans fonts (Geist, Inter, SF Pro) with monospace font numerals for deterministic accounting.
          </p>
        </div>
      </div>
    </div>
  );
}
