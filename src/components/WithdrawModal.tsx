'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faArrowUp,
  faCircleCheck,
  faWallet,
  faExternalLink,
  faTriangleExclamation,
  faShieldHalved,
  faChartPie,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { buildWithdrawTransaction } from '../lib/solana/contract-client';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  portfolioValueUsdc: number;
  vaultCashReserveUsdc?: number;
  activePositionsUsdc?: number;
  realSolBalance: number | null;
  realUsdcBalance: number | null;
  realVaultBalance: number | null;
  solPriceUsd: number;
  connected: boolean;
  publicKey: PublicKey | null;
  onWithdrawSuccess: (
    amountUsdc: number,
    asset: 'USDC' | 'SOL',
    txSig: string,
    source: 'reserve' | 'positions'
  ) => void;
}

export default function WithdrawModal({
  isOpen,
  onClose,
  theme = 'dark',
  portfolioValueUsdc,
  vaultCashReserveUsdc = 0,
  activePositionsUsdc = 0,
  realSolBalance,
  realUsdcBalance,
  realVaultBalance,
  solPriceUsd,
  connected,
  publicKey: propPublicKey,
  onWithdrawSuccess,
}: WithdrawModalProps) {
  const { connection } = useConnection();
  const { publicKey: walletPublicKey, sendTransaction, signTransaction } = useWallet();
  const activePublicKey = propPublicKey || walletPublicKey;

  // Safe withdrawable SOL from on-chain Vault PDA (maintains ~0.0013 SOL rent-exemption)
  const safeVaultSol = Math.max(0, (realVaultBalance ?? 0) - 0.002);
  const vaultReserveUsdTotal =
    (vaultCashReserveUsdc > 0 ? vaultCashReserveUsdc : 0) + safeVaultSol * (solPriceUsd > 0 ? solPriceUsd : 140);

  const [withdrawSource, setWithdrawSource] = useState<'reserve' | 'positions'>(
    (realVaultBalance ?? 0) > 0.005 || vaultCashReserveUsdc > 0 ? 'reserve' : 'positions'
  );
  const [withdrawAsset, setWithdrawAsset] = useState<'USDC' | 'SOL'>('SOL');
  const [amountInput, setAmountInput] = useState(() =>
    safeVaultSol > 0 ? (safeVaultSol >= 0.1 ? '0.1000' : safeVaultSol.toFixed(4)) : '0.0500'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefueling, setIsRefueling] = useState(false);
  const [refuelMessage, setRefuelMessage] = useState<string | null>(null);

  const handleRefuelGas = async () => {
    if (!activePublicKey) return;
    setIsRefueling(true);
    setErrorMessage(null);
    setRefuelMessage(null);
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: activePublicKey.toBase58() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRefuelMessage('Airdropped 1.0 Devnet SOL! Gas refueled.');
      } else {
        setErrorMessage(data.message || 'Devnet gas faucet rate-limited. Please use https://faucet.solana.com');
      }
    } catch {
      setErrorMessage('Failed to connect to Devnet gas faucet.');
    } finally {
      setIsRefueling(false);
    }
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';

  // Active positions basket
  const positionsUsdc = activePositionsUsdc;
  const positionsSol = solPriceUsd > 0 ? positionsUsdc / solPriceUsd : 0;

  // Available to withdraw based on selected layer and asset
  let maxAvailable = 0;
  if (withdrawSource === 'reserve') {
    maxAvailable = withdrawAsset === 'SOL' ? safeVaultSol : vaultReserveUsdTotal;
  } else {
    maxAvailable = withdrawAsset === 'SOL' ? positionsSol : positionsUsdc;
  }

  const parsedAmount = parseFloat(amountInput) || 0;
  const amountUsdcEquivalent =
    withdrawAsset === 'USDC' ? parsedAmount : parsedAmount * (solPriceUsd > 0 ? solPriceUsd : 140);

  const handleToggleSource = (source: 'reserve' | 'positions') => {
    setWithdrawSource(source);
    setErrorMessage(null);
    if (withdrawAsset === 'SOL') {
      const avail = source === 'reserve' ? safeVaultSol : positionsSol;
      setAmountInput(avail > 0 ? (avail >= 0.1 ? '0.1000' : avail.toFixed(4)) : '0.0000');
    } else {
      const avail = source === 'reserve' ? vaultReserveUsdTotal : positionsUsdc;
      setAmountInput(avail > 0 ? (avail >= 25 ? '25.00' : avail.toFixed(2)) : '0.00');
    }
  };

  const handleToggleAsset = (asset: 'USDC' | 'SOL') => {
    setWithdrawAsset(asset);
    setErrorMessage(null);
    if (asset === 'SOL') {
      const avail = withdrawSource === 'reserve' ? safeVaultSol : positionsSol;
      setAmountInput(avail > 0 ? (avail >= 0.1 ? '0.1000' : avail.toFixed(4)) : '0.0000');
    } else {
      const avail = withdrawSource === 'reserve' ? vaultReserveUsdTotal : positionsUsdc;
      setAmountInput(avail > 0 ? (avail >= 25 ? '25.00' : avail.toFixed(2)) : '0.00');
    }
  };

  const handleSetPercent = (pct: number) => {
    const val = (maxAvailable * pct) / 100;
    setAmountInput(withdrawAsset === 'USDC' ? val.toFixed(2) : val.toFixed(4));
  };

  const handleExecuteWithdraw = async () => {
    if (parsedAmount <= 0) {
      setErrorMessage('Please enter a valid withdrawal amount.');
      return;
    }
    if (maxAvailable <= 0) {
      setErrorMessage(
        `Selected source balance is 0 (${withdrawSource === 'reserve' ? 'Vault Reserve' : 'Active Positions'}).`
      );
      return;
    }
    if (parsedAmount > maxAvailable + 0.0001) {
      setErrorMessage(
        `Withdrawal amount exceeds available balance (${withdrawAsset === 'USDC' ? '$' + maxAvailable.toFixed(2) : maxAvailable.toFixed(4) + ' SOL'}).`
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    // Auto-refuel gas if wallet SOL is critically low (< 0.003 SOL)
    if (realSolBalance !== null && realSolBalance < 0.003 && activePublicKey) {
      try {
        await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: activePublicKey.toBase58() }),
        });
      } catch {
        // Proceed with transaction attempt
      }
    }

    try {
      if (!activePublicKey) {
        throw new Error('Please connect your Solana wallet first.');
      }

      // Build real on-chain Anchor withdrawal transaction
      const tx = await buildWithdrawTransaction(
        connection,
        activePublicKey,
        withdrawAsset,
        parsedAmount
      );

      let sig = '';

      if (signTransaction) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = activePublicKey;

        const signedTx = await signTransaction(tx);
        const rawBytes = signedTx.serialize();

        try {
          sig = await connection.sendRawTransaction(rawBytes, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } catch (directRpcErr: any) {
          console.warn('[StockPilot] Direct RPC broadcast failed, using backend relay:', directRpcErr?.message);
          const relayRes = await fetch('/api/send-tx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawTransaction: Buffer.from(rawBytes).toString('base64') }),
          });
          const relayData = await relayRes.json();
          if (!relayRes.ok || !relayData.success) {
            throw new Error(relayData.error || directRpcErr?.message || 'Transaction broadcast failed.');
          }
          sig = relayData.signature;
        }

        // Confirm transaction
        try {
          await connection.confirmTransaction(
            {
              signature: sig,
              blockhash,
              lastValidBlockHeight,
            },
            'confirmed'
          );
        } catch (cErr: any) {
          console.warn('[StockPilot] Confirmation check note:', cErr?.message);
        }
      } else if (sendTransaction) {
        sig = await sendTransaction(tx, connection, {
          preflightCommitment: 'confirmed',
        });

        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          await connection.confirmTransaction(
            {
              signature: sig,
              blockhash,
              lastValidBlockHeight,
            },
            'confirmed'
          );
        } catch (cErr: any) {
          console.warn('[StockPilot] Confirmation check note:', cErr?.message);
        }
      } else {
        throw new Error('No transaction signing provider found in connected wallet.');
      }

      setTxSignature(sig);
      setTxSuccess(true);
      setIsSubmitting(false);
      onWithdrawSuccess(amountUsdcEquivalent, withdrawAsset, sig, withdrawSource);
    } catch (err: any) {
      console.error('[StockPilot] Withdrawal error:', err);
      setIsSubmitting(false);
      const msg = String(err?.message || err || '');
      if (msg.includes('User rejected') || err?.name === 'WalletSignTransactionError') {
        setErrorMessage('Transaction was cancelled by user in wallet.');
      } else if (msg.includes('InsufficientFundsForRent') || msg.includes('insufficient funds for rent')) {
        setErrorMessage('Cannot withdraw full SOL amount: vault requires ~0.0013 SOL to stay rent-exempt.');
      } else {
        setErrorMessage(msg.slice(0, 160) || 'Failed to execute withdrawal transaction.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-black/80'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl transition cursor-pointer ${
            isLight
              ? 'text-slate-400 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
        </button>

        {txSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FontAwesomeIcon icon={faCircleCheck} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">Withdrawal Confirmed</h3>
              <p
                className={`text-xs mt-1 ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {amountInput} {withdrawAsset} returned to your wallet from{' '}
                <span className="font-semibold text-[#00D2FF]">
                  {withdrawSource === 'reserve' ? 'Vault Cash Reserve' : 'Active Strategy Positions'}
                </span>
              </p>
            </div>
            <div
              className={`p-3 rounded-xl border text-left font-mono text-[11px] space-y-1.5 ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#06080F] border-[#1E293B]'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Transaction Hash:</span>
                <span className="text-emerald-400 font-sans font-bold">Confirmed</span>
              </div>
              <a
                href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D2FF] hover:underline flex items-center justify-between gap-1 truncate text-[11px]"
              >
                <span className="truncate">{txSignature}</span>
                <FontAwesomeIcon icon={faExternalLink} className="w-2.5 h-2.5 shrink-0" />
              </a>
              <div className="text-slate-400 text-[10px] pt-1">
                Recipient Wallet:{' '}
                {activePublicKey
                  ? `${activePublicKey.toBase58().slice(0, 6)}...${activePublicKey
                      .toBase58()
                      .slice(-4)}`
                  : 'Your Wallet'}
              </div>
            </div>
            <button
              onClick={() => {
                setTxSuccess(false);
                onClose();
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isLight
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8]'
              }`}
            >
              View in Portfolio
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs">
                  <FontAwesomeIcon icon={faArrowUp} className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Withdraw Funds</h3>
                  <p
                    className={`text-[11px] ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Withdraw non-custodial PDA vault funds to your wallet
                  </p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="w-4 h-4 shrink-0 mt-0.5"
                />
                <span className="break-all">{errorMessage}</span>
              </div>
            )}

            {/* Low Gas Notice & 1-Click Refuel */}
            {realSolBalance !== null && realSolBalance < 0.005 && (
              <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <div className="font-bold text-[11px]">Low Gas ({realSolBalance.toFixed(4)} SOL)</div>
                    <div className="text-[10px] text-zinc-400 truncate">Solana requires ~0.002 SOL for transaction fee & rent.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefuelGas}
                  disabled={isRefueling}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] hover:bg-amber-400 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isRefueling ? 'Refueling...' : 'Refuel (1 SOL)'}
                </button>
              </div>
            )}

            {refuelMessage && (
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-2">
                <FontAwesomeIcon icon={faCircleCheck} className="w-3.5 h-3.5 shrink-0" />
                <span>{refuelMessage}</span>
              </div>
            )}

            {/* Source Layer Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Withdraw From Layer
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSource('reserve')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    withdrawSource === 'reserve'
                      ? isLight
                        ? 'bg-sky-50 border-sky-500 text-slate-900 ring-1 ring-sky-500'
                        : 'bg-[#00D2FF]/10 border-[#00D2FF] text-white ring-1 ring-[#00D2FF]'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-[#06080F] border-[#1E293B] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px]">Vault Reserve</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
                    {safeVaultSol > 0 ? `${safeVaultSol.toFixed(4)} SOL` : `$${vaultCashReserveUsdc.toFixed(2)}`}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSource('positions')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    withdrawSource === 'positions'
                      ? isLight
                        ? 'bg-sky-50 border-sky-500 text-slate-900 ring-1 ring-sky-500'
                        : 'bg-[#00D2FF]/10 border-[#00D2FF] text-white ring-1 ring-[#00D2FF]'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-[#06080F] border-[#1E293B] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px]">Active Basket</span>
                  </div>
                  <div className="text-[10px] text-sky-400 font-mono mt-1 font-bold">
                    ${activePositionsUsdc.toFixed(2)} USDC
                  </div>
                </button>
              </div>
            </div>

            {/* Asset Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/20 border border-white/5 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleToggleAsset('SOL')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  withdrawAsset === 'SOL'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-[#1E293B] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SOL (Vault Native)
              </button>
              <button
                type="button"
                onClick={() => handleToggleAsset('USDC')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  withdrawAsset === 'USDC'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-[#1E293B] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                USDC (Direct)
              </button>
            </div>

            {/* Available Balance Box */}
            <div
              className={`p-3 rounded-2xl border text-xs font-mono space-y-1 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#06080F] border-[#1E293B]'
              }`}
            >
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Available to Withdraw:</span>
                <span className={`${isLight ? 'text-slate-900' : 'text-white'} font-bold`}>
                  {withdrawAsset === 'USDC'
                    ? `$${maxAvailable.toFixed(2)} USDC`
                    : `${maxAvailable.toFixed(4)} SOL`}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Source:</span>
                <span className="text-[#00D2FF] font-semibold">
                  {withdrawSource === 'reserve' ? 'Non-Custodial Vault PDA' : 'Active Strategy Basket'}
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={`w-full rounded-xl border p-2.5 font-mono text-sm focus:outline-none transition ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-sky-500'
                      : 'bg-[#06080F] border-[#1E293B] text-white focus:border-[#00D2FF]'
                  }`}
                  placeholder="10"
                />
                <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400">
                  {withdrawAsset}
                </span>
              </div>
            </div>

            {/* Percentage Chips */}
            <div className="flex gap-2 text-xs font-mono">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetPercent(pct)}
                  className={`flex-1 py-1.5 rounded-lg border transition cursor-pointer text-[11px] ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-[#101828] border-[#1E293B] text-slate-300 hover:bg-[#162338]'
                  }`}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Action CTA */}
            <button
              onClick={handleExecuteWithdraw}
              disabled={isSubmitting || parsedAmount <= 0 || maxAvailable <= 0}
              className={`w-full rounded-xl py-3 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 ${
                isLight
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-600/20'
                  : 'bg-purple-500 text-white hover:bg-purple-400 shadow-purple-500/20'
              }`}
            >
              <FontAwesomeIcon icon={faArrowUp} className="w-3 h-3" />
              <span>
                {isSubmitting
                  ? 'Processing On-Chain...'
                  : `Withdraw $${amountUsdcEquivalent.toFixed(2)} to Wallet`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
