'use client';

import React, { useState } from 'react';
import { Coins, CheckCircle, Copy, Check, ExternalLink, Loader2, Sparkles, X, ArrowUpRight } from 'lucide-react';
import { requestDevnetAirdrop, FaucetAirdropResult } from '@/lib/solana/devnet-tokens';

interface DevnetFaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
  onSuccessFund?: (amount: number) => void;
}

export default function DevnetFaucetModal({
  isOpen,
  onClose,
  walletAddress,
  onSuccessFund
}: DevnetFaucetModalProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<FaucetAirdropResult | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    setLoading(true);
    setResult(null);
    try {
      const address = walletAddress || 'DemoVault111111111111111111111111111111111111';
      const res = await requestDevnetAirdrop(address, 1000);
      setResult(res);
      if (onSuccessFund) {
        onSuccessFund(1000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1017] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14F195]/10 border border-[#14F195]/20 text-[#14F195]">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Devnet Test Faucet</h3>
            <p className="text-xs text-zinc-400">Fund your connected wallet on Solana Devnet</p>
          </div>
        </div>

        {/* Target Wallet Info Box */}
        <div className="mt-5 space-y-2.5 rounded-xl border border-white/5 bg-[#171822] p-3.5 text-xs text-zinc-300 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Target Network:</span>
            <span className="font-semibold text-[#14F195]">Solana Devnet</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Wallet Recipient:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-300 truncate max-w-[140px]">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No Wallet'}
              </span>
              {walletAddress && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Copy full address"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Official Faucet Options */}
        <div className="mt-4 space-y-2">
          <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            Official Faucet Providers
          </label>
          
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border border-[#00D2FF]/30 bg-[#00D2FF]/5 hover:bg-[#00D2FF]/10 text-xs text-white transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#00D2FF]/20 flex items-center justify-center text-[#00D2FF] font-bold text-xs">
                $
              </div>
              <div>
                <div className="font-bold text-[#00D2FF]">Circle Official USDC Faucet</div>
                <div className="text-[11px] text-zinc-400">Get 10 - 100 real Devnet USDC (Circle)</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#00D2FF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </a>

          <a
            href={`https://faucet.solana.com/?address=${walletAddress || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-xs text-white transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
                ◎
              </div>
              <div>
                <div className="font-bold text-purple-300">Solana Web Faucet</div>
                <div className="text-[11px] text-zinc-400">Get 1 - 5 Devnet SOL for trading & gas</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </a>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-[#14F195]/30 bg-[#14F195]/10 p-3.5 text-xs text-[#14F195]">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle className="h-4 w-4" />
              <span>Devnet Faucet Signal Broadcasted!</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-300">{result.message}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleClaim}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] py-2.5 text-xs font-bold text-black shadow-lg shadow-[#14F195]/20 hover:opacity-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
                <span>Requesting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-black" />
                <span>1-Tap Devnet Airdrop</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
