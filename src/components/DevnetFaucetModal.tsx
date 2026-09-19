'use client';

import React, { useState } from 'react';
import { Coins, CheckCircle, ExternalLink, Loader2, Sparkles, X } from 'lucide-react';
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
  const [result, setResult] = useState<FaucetAirdropResult | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1017] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14F195]/10 border border-[#14F195]/20 text-[#14F195]">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Devnet Test Faucet</h3>
            <p className="text-xs text-zinc-400">Claim 1,000 Devnet USDC for testing</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-white/5 bg-[#171822] p-4 text-xs text-zinc-300">
          <div className="flex justify-between">
            <span className="text-zinc-400">Target Network:</span>
            <span className="font-semibold text-[#14F195]">Solana Devnet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Airdrop Asset:</span>
            <span className="font-semibold text-white">1,000.00 USDC + Gas</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Target Recipient:</span>
            <span className="font-mono text-zinc-300 truncate max-w-[180px]">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}` : 'Active Test Vault'}
            </span>
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-[#14F195]/30 bg-[#14F195]/10 p-4 text-xs text-[#14F195]">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle className="h-4 w-4" />
              <span>Devnet Funding Activated!</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-300">{result.message}</p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline text-[#14F195] hover:text-white"
              >
                <span>View on Solana Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`https://faucet.solana.com/?address=${walletAddress || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:underline"
              >
                <span>Solana Web Faucet</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] py-2.5 text-xs font-bold text-black shadow-lg shadow-[#14F195]/20 hover:opacity-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Claiming on Devnet...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-black" />
                <span>Claim Devnet USDC</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
