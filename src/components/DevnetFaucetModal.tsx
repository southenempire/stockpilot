'use client';

import React, { useState } from 'react';
import {
  Coins,
  CheckCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface DevnetFaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
  realSolBalance?: number | null;
  realUsdcBalance?: number | null;
  onSuccessFund?: (amountUsdc: number, amountSol: number, txSig: string) => void;
}

export default function DevnetFaucetModal({
  isOpen,
  onClose,
  walletAddress,
  realSolBalance,
  realUsdcBalance,
  onSuccessFund,
}: DevnetFaucetModalProps) {
  const { setVisible: openWalletModal } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [result, setResult] = useState<{
    success: boolean;
    solAirdropped: number;
    usdcCredits: number;
    txSignature: string;
    explorerUrl: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeAddress = walletAddress || customAddress.trim();

  const handleCopy = () => {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    const target = activeAddress || 'DemoVault111111111111111111111111111111111111';
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: target }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim from faucet');
      }

      setResult({
        success: true,
        solAirdropped: data.solAirdropped || 1.0,
        usdcCredits: data.usdcCredits || 1000,
        txSignature: data.txSignature,
        explorerUrl: data.explorerUrl,
        message: data.message,
      });

      if (onSuccessFund) {
        onSuccessFund(data.usdcCredits || 1000, data.solAirdropped || 1.0, data.txSignature);
      }
    } catch (e: any) {
      console.error('Faucet claim error:', e);
      setError(e?.message || 'Devnet airdrop request failed. Please try again.');
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
            <p className="text-xs text-zinc-400">Fund your wallet with Devnet SOL & Devnet USDC</p>
          </div>
        </div>

        {/* Target Wallet Info Box */}
        <div className="mt-5 space-y-2.5 rounded-xl border border-white/5 bg-[#171822] p-3.5 text-xs text-zinc-300 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Target Network:</span>
            <span className="font-semibold text-[#14F195] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
              Solana Devnet
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Wallet Recipient:</span>
            <div className="flex items-center gap-1.5">
              {walletAddress ? (
                <>
                  <span className="text-zinc-300 truncate max-w-[140px]">
                    {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copy full address"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openWalletModal(true);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-bold hover:bg-sky-500/30 cursor-pointer transition"
                >
                  <Wallet className="w-3 h-3" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>

          {/* Current Live Balances */}
          {walletAddress && (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-500">Devnet SOL:</span>{' '}
                <span className="font-bold text-purple-400">
                  {realSolBalance !== null && realSolBalance !== undefined
                    ? `${realSolBalance.toFixed(3)} SOL`
                    : '0.000 SOL'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500">Devnet USDC:</span>{' '}
                <span className="font-bold text-emerald-400">
                  ${(realUsdcBalance ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Official Faucet Providers Links */}
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

        {/* Error Notification */}
        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="mt-4 rounded-xl border border-[#14F195]/30 bg-[#14F195]/10 p-3.5 text-xs text-[#14F195]">
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>Devnet Airdrop Confirmed!</span>
              </div>
              {result.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] underline flex items-center gap-0.5 hover:text-white"
                >
                  <span>Explorer</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-300">{result.message}</p>
          </div>
        )}

        {/* Bottom Actions */}
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
                <span>Requesting Devnet...</span>
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
