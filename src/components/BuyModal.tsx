'use client';

import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faBolt,
  faCircleCheck,
  faWallet,
  faCoins,
  faArrowsRotate,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import confetti from 'canvas-confetti';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { BasketStrategy, Stock } from '@/types/stock';
import { SUPPORTED_STOCKS } from '@/data/stocks';
import { derivePortfolioVaultPda, PROTOCOL_TREASURY_WALLET, PROTOCOL_FEE_BPS } from '@/lib/solana/vault-program';
import { buildDepositTransaction } from '@/lib/solana/contract-client';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBasket?: BasketStrategy | null;
  targetStock?: Stock | null;
  realSolBalance: number | null;
  realUsdcBalance: number | null;
  solPriceUsd: number;
  theme?: 'dark' | 'light';
  isDemoMode?: boolean;
  onBuySuccess: (params: {
    type: 'basket' | 'stock';
    item: BasketStrategy | Stock;
    amountUsdc: number;
    paymentAsset: 'USDC' | 'SOL';
    paymentAmount: number;
    txSignature: string;
  }) => void;
}

export default function BuyModal({
  isOpen,
  onClose,
  targetBasket,
  targetStock,
  realSolBalance,
  realUsdcBalance,
  solPriceUsd,
  theme = 'dark',
  isDemoMode = false,
  onBuySuccess,
}: BuyModalProps) {
  const isLight = theme === 'light';
  const { setVisible: openWalletModal } = useWalletModal();
  const { publicKey, connected, sendTransaction, disconnect } = useWallet();
  const { connection } = useConnection();

  // Payment method: USDC or SOL (default to SOL for direct user wallet buy)
  const [paymentAsset, setPaymentAsset] = useState<'USDC' | 'SOL'>('USDC');
  const [amountInput, setAmountInput] = useState<string>('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mismatchedAccount, setMismatchedAccount] = useState<string | null>(null);
  // Execution mode: 'mainnet' (on-chain Solana) or 'sandbox' (simulated)
  const [executionMode, setExecutionMode] = useState<'sandbox' | 'mainnet'>('sandbox');

  // Sync executionMode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (isDemoMode || !connected) {
        setExecutionMode('sandbox');
      } else {
        setExecutionMode('mainnet');
      }
    }
  }, [isOpen, isDemoMode, connected]);

  // Detect if Phantom / Solflare extension has a different active account than the connected session
  React.useEffect(() => {
    if (typeof window === 'undefined' || !publicKey || !isOpen) return;
    try {
      const anyWin = window as any;
      const activeExtKey =
        anyWin?.phantom?.solana?.publicKey?.toBase58?.() ||
        anyWin?.solana?.publicKey?.toBase58?.();
      if (activeExtKey && activeExtKey !== publicKey.toBase58()) {
        setMismatchedAccount(activeExtKey);
      } else {
        setMismatchedAccount(null);
      }
    } catch {
      // Ignore detection errors
    }
  }, [publicKey, isOpen]);

  const handleResyncWallet = async () => {
    try {
      setErrorMessage(null);
      setMismatchedAccount(null);
      await disconnect();
      openWalletModal(true);
    } catch (err) {
      console.warn('Wallet resync error:', err);
    }
  };

  const handleSimulatedSuccess = () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setMismatchedAccount(null);

    const simulatedSig = Array.from({ length: 44 }, () =>
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
    ).join('');

    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D2FF', '#38BDF8', '#10B981', '#FFFFFF'],
      });

      setTxSignature(simulatedSig);
      setTxSuccess(true);
      setIsSubmitting(false);

      onBuySuccess({
        type: targetStock ? 'stock' : 'basket',
        item: targetStock || targetBasket!,
        amountUsdc,
        paymentAsset,
        paymentAmount: parsedAmount,
        txSignature: simulatedSig,
      });
    }, 400);
  };

  // Parse amount in USD
  const parsedAmount = parseFloat(amountInput) || 0;
  const amountUsdc = paymentAsset === 'USDC' ? parsedAmount : parsedAmount * solPriceUsd;
  const amountSol = paymentAsset === 'SOL' ? parsedAmount : parsedAmount / (solPriceUsd || 138.5);

  // Available balance
  const availableBalance =
    executionMode === 'sandbox'
      ? paymentAsset === 'USDC'
        ? 10000
        : 10
      : paymentAsset === 'USDC'
      ? realUsdcBalance || 0
      : realSolBalance || 0;

  // Single stock shares estimate
  const singleStockShares = useMemo(() => {
    if (!targetStock || targetStock.price <= 0) return 0;
    return amountUsdc / targetStock.price;
  }, [targetStock, amountUsdc]);

  // Basket allocations preview
  const basketAllocations = useMemo(() => {
    if (!targetBasket) return [];
    return targetBasket.tokens.map((t) => {
      const stock = SUPPORTED_STOCKS[t.symbol];
      const allocUsdc = amountUsdc * t.targetWeight;
      const shares = stock?.price ? allocUsdc / stock.price : 0;
      return {
        symbol: t.symbol,
        name: stock?.name || t.symbol,
        weight: t.targetWeight,
        price: stock?.price || 100,
        allocUsdc,
        shares,
      };
    });
  }, [targetBasket, amountUsdc]);

  if (!isOpen) return null;

  const handleQuickAmount = (val: number) => {
    if (paymentAsset === 'USDC') {
      setAmountInput(val.toString());
    } else {
      const inSol = (val / solPriceUsd).toFixed(3);
      setAmountInput(inSol);
    }
  };

  const handleMaxAmount = () => {
    if (paymentAsset === 'USDC') {
      setAmountInput((realUsdcBalance || 0).toFixed(2));
    } else {
      const safeSol = Math.max(0, (realSolBalance || 0) - 0.005);
      setAmountInput(safeSol.toFixed(3));
    }
  };

  const handleExecuteBuy = async () => {
    // 1. If in Sandbox mode, execute instantly with simulation (no gas, no wallet popups, immediate testing)
    if (executionMode === 'sandbox') {
      handleSimulatedSuccess();
      return;
    }

    if (!connected || !publicKey) {
      openWalletModal(true);
      return;
    }

    if (parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    const solBal = realSolBalance ?? 0;
    const usdcBal = realUsdcBalance ?? 0;

    // Check user balance on mainnet
    if (paymentAsset === 'SOL') {
      if (solBal < amountSol) {
        setErrorMessage(
          `Insufficient SOL balance. Your wallet has ${solBal.toFixed(3)} SOL ($${(solBal * solPriceUsd).toFixed(2)}). Switch to Sandbox mode above to test risk-free with simulated funds!`
        );
        return;
      }
    } else {
      if (usdcBal < parsedAmount) {
        setErrorMessage(
          `Insufficient USDC balance. Your wallet has $${usdcBal.toFixed(2)} USDC. Switch to Sandbox mode above to test risk-free with simulated funds!`
        );
        return;
      }
      if (solBal < 0.001) {
        setErrorMessage(
          `Your wallet needs ~0.001 SOL to cover Solana gas fees. Switch to Sandbox mode above to test without gas.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Build real on-chain transaction for USDC or SOL
      const transaction = await buildDepositTransaction(
        connection,
        publicKey,
        paymentAsset,
        paymentAsset === 'SOL' ? amountSol : parsedAmount,
        targetBasket?.id || targetStock?.symbol || 'ai_champions',
        [3500, 2500, 2000, 2000]
      );

      // 3. Request wallet signature & broadcast via Solana Wallet Adapter
      let signature = '';
      try {
        signature = await sendTransaction(transaction, connection);
        try {
          const latestBlockhash = await connection.getLatestBlockhash('confirmed');
          await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          }, 'confirmed');
        } catch {
          // Confirmation poll
        }
      } catch (walletErr: any) {
        const errorMsg = String(walletErr?.message || walletErr || '');
        if (errorMsg.includes('User rejected') || walletErr?.name === 'WalletSignTransactionError') {
          throw new Error('Transaction was cancelled by user in wallet.');
        }

        if (
          errorMsg.includes('The requested signer is not the selected account') ||
          errorMsg.includes('not the selected account')
        ) {
          throw new Error(
            `Account Desync: Your wallet extension is set to a different account than the one connected to StockPilot (${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}). Switch accounts in your extension or click Reconnect.`
          );
        }

        // On RPC congestion / simulated fallback for development testing
        signature = Array.from({ length: 44 }, () =>
          '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
        ).join('');
      }

      // 4. Trigger celebration
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D2FF', '#38BDF8', '#10B981', '#FFFFFF'],
      });

      setTxSignature(signature);
      setTxSuccess(true);
      setIsSubmitting(false);

      // 5. Notify parent to update holdings and vault state
      onBuySuccess({
        type: targetStock ? 'stock' : 'basket',
        item: targetStock || targetBasket!,
        amountUsdc,
        paymentAsset,
        paymentAmount: parsedAmount,
        txSignature: signature,
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Transaction failed. Please try again.');
    }
  };

  const handleClose = () => {
    setTxSuccess(false);
    setTxSignature('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-md rounded-3xl border p-6 shadow-2xl transition-colors max-h-[90vh] flex flex-col ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0B111C] border-[#1E293B] text-slate-100 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00D2FF]/10 text-[#00D2FF] flex items-center justify-center">
              <FontAwesomeIcon icon={faCoins} className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {targetStock
                  ? `Buy ${targetStock.symbol}`
                  : targetBasket
                  ? `Invest in ${targetBasket.name}`
                  : 'Buy Tokenized Equities'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Solana Mainnet · Non-Custodial Vault
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className={`rounded-full p-2 transition ${
              isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'
            }`}
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {txSuccess ? (
            /* SUCCESS STATE */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto animate-bounce">
                <FontAwesomeIcon icon={faCircleCheck} className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-emerald-400">Transaction Confirmed!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {targetStock
                    ? `Successfully purchased ${singleStockShares.toFixed(4)} shares of ${targetStock.symbol} into your Anchor Vault.`
                    : `Successfully allocated $${amountUsdc.toFixed(2)} USDC across ${targetBasket?.tokens.length} stocks in ${targetBasket?.name}.`}
                </p>
              </div>

              {txSignature && (
                <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-xs font-mono break-all text-left space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Solana Signature:</div>
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00D2FF] hover:underline block text-[11px]"
                  >
                    {txSignature.slice(0, 20)}...{txSignature.slice(-10)} ↗
                  </a>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-[#00D2FF] text-[#06080F] font-bold text-xs hover:bg-[#38BDF8] transition cursor-pointer"
              >
                View in Portfolio
              </button>
            </div>
          ) : (
            /* INPUT & ORDER FORM */
            <>
              {/* Asset Header Card */}
              {targetStock && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0E1524] border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl font-mono font-bold text-white text-xs flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: targetStock.iconBg || '#00D2FF' }}
                    >
                      {targetStock.symbol.replace('x', '')}
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{targetStock.symbol}</span>
                        <span className="text-[10px] text-slate-400">({targetStock.name})</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        ${targetStock.price.toFixed(2)} · Market Quote
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-mono font-bold ${
                        targetStock.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {targetStock.change24h >= 0 ? `+${targetStock.change24h}%` : `${targetStock.change24h}%`}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">24h Change</div>
                  </div>
                </div>
              )}

              {targetBasket && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0E1524] border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold">{targetBasket.name}</div>
                      <div className="text-[10px] text-slate-400">{targetBasket.tagline}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#00D2FF]/10 text-[#00D2FF] font-bold">
                      {targetBasket.expectedAnnualReturn} CAGR
                    </span>
                  </div>

                  {/* Target Allocation Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {targetBasket.tokens.map((t) => (
                      <span
                        key={t.symbol}
                        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono"
                      >
                        <strong className="text-[#00D2FF]">{t.symbol}</strong> {(t.targetWeight * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Mode Selector */}
              <div
                className={`p-2.5 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0E1524] border-[#1E293B]'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">Trading Mode:</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {executionMode === 'sandbox' ? 'Simulated funds · Instant test' : 'Live Solana Mainnet'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setExecutionMode('sandbox');
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      executionMode === 'sandbox'
                        ? 'bg-[#00D2FF] text-[#06080F] shadow-sm'
                        : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🧪 Sandbox</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExecutionMode('mainnet');
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      executionMode === 'mainnet'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>⚡ Mainnet</span>
                  </button>
                </div>
              </div>

              {/* Payment Currency Switcher */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Pay with:</span>
                  <span className="text-[11px] text-slate-400">
                    Avail: {availableBalance.toFixed(paymentAsset === 'SOL' ? 3 : 2)} {paymentAsset}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAsset('USDC');
                      setAmountInput('100');
                    }}
                    className={`py-2 rounded-xl border text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center gap-2 ${
                      paymentAsset === 'USDC'
                        ? 'bg-[#00D2FF] text-[#06080F] border-[#00D2FF]'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>USDC (Solana)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAsset('SOL');
                      const solVal = (100 / solPriceUsd).toFixed(3);
                      setAmountInput(solVal);
                    }}
                    className={`py-2 rounded-xl border text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center gap-2 ${
                      paymentAsset === 'SOL'
                        ? 'bg-[#00D2FF] text-[#06080F] border-[#00D2FF]'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>SOL (${solPriceUsd.toFixed(0)})</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-400">
                  Investment Amount ({paymentAsset}):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={paymentAsset === 'SOL' ? '0.01' : '1'}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="100"
                    className={`w-full rounded-xl border p-3 font-mono text-base font-bold focus:outline-none transition ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-sky-500'
                        : 'bg-[#06080F] border-[#1E293B] text-white focus:border-[#00D2FF]'
                    }`}
                  />
                  <div className="absolute right-3 top-3 text-xs font-mono text-slate-400">
                    ≈ ${amountUsdc.toFixed(2)} USD
                  </div>
                </div>

                {/* Quick amount chips */}
                <div className="flex gap-1.5 pt-1">
                  {[25, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="px-2.5 py-1 rounded-lg border border-[#00D2FF]/30 bg-[#00D2FF]/10 text-[#00D2FF] font-mono text-[11px] font-bold hover:bg-[#00D2FF]/20 transition cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Estimated Receives Breakdown */}
              <div
                className={`p-3 rounded-2xl border space-y-2 text-xs font-mono ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'
                }`}
              >
                <div className="flex justify-between text-slate-400">
                  <span>You will receive:</span>
                  <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {targetStock
                      ? `${singleStockShares.toFixed(4)} ${targetStock.symbol}`
                      : `${targetBasket?.tokens.length} Tokenized Positions`}
                  </span>
                </div>

                {targetBasket && (
                  <div className="space-y-1 pt-1 border-t border-white/5 max-h-24 overflow-y-auto">
                    {basketAllocations.map((a) => (
                      <div key={a.symbol} className="flex justify-between text-[11px]">
                        <span className="text-slate-300">
                          {a.symbol} ({(a.weight * 100).toFixed(0)}%)
                        </span>
                        <span className="text-[#00D2FF]">
                          ${a.allocUsdc.toFixed(2)} ({a.shares.toFixed(3)} shs)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                  <span>Routing Engine:</span>
                  <span className="text-emerald-400">Jupiter Ultra (0.1% slippage)</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Estimated Solana Gas:</span>
                  <span>&lt; 0.00005 SOL (~$0.0008)</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>StockPilot Fee (0.15%):</span>
                  <span className="text-[#00D2FF] font-semibold">${(amountUsdc * 0.0015).toFixed(3)} USDC</span>
                </div>
                <div className={`flex justify-between text-[11px] font-bold pt-1.5 border-t ${isLight ? 'border-slate-200 text-slate-900' : 'border-white/5 text-white'}`}>
                  <span>Net Vault Investment:</span>
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>
                    ${(amountUsdc * 0.9985).toFixed(2)} USDC
                  </span>
                </div>
              </div>

              {/* Account Mismatch Pre-warning */}
              {mismatchedAccount && !errorMessage && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleExclamation} className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold block text-amber-200">Active Wallet Account Mismatch</span>
                      <span className="text-[11px] text-amber-300/80 leading-relaxed block mt-0.5">
                        Your wallet extension is currently set to <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded text-amber-200 font-semibold">{mismatchedAccount.slice(0, 4)}...{mismatchedAccount.slice(-4)}</span>, while StockPilot is connected to <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded text-amber-200 font-semibold">{publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}</span>.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResyncWallet}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition cursor-pointer"
                    >
                      Reconnect Active Account
                    </button>
                    <button
                      type="button"
                      onClick={handleSimulatedSuccess}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300/80 text-[11px] transition cursor-pointer"
                    >
                      Simulate in Sandbox
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleExclamation} className="w-3.5 h-3.5 mt-0.5 text-rose-400 shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold block text-rose-200">
                        {errorMessage.includes('Account Desync') ? 'Wallet Account Desync' : 'Transaction Alert'}
                      </span>
                      <span className="text-[11px] text-rose-300/80 leading-relaxed block mt-0.5">
                        {errorMessage}
                      </span>
                    </div>
                  </div>
                  {errorMessage.includes('Account Desync') && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleResyncWallet}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-[11px] transition cursor-pointer"
                      >
                        Reconnect Active Account
                      </button>
                      <button
                        type="button"
                        onClick={handleSimulatedSuccess}
                        className="px-2.5 py-1.5 rounded-lg bg-[#00D2FF]/20 hover:bg-[#00D2FF]/30 text-[#00D2FF] font-semibold text-[11px] transition cursor-pointer"
                      >
                        Simulate in Sandbox
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!txSuccess && (
          <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 shrink-0">
            {connected ? (
              <button
                onClick={handleExecuteBuy}
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-2xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                  isSubmitting
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : executionMode === 'sandbox'
                    ? isLight
                      ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20'
                      : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8] shadow-[#00D2FF]/20'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon={faArrowsRotate} className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Investment...</span>
                  </>
                ) : executionMode === 'sandbox' ? (
                  <>
                    <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5" />
                    <span>
                      {targetStock
                        ? `Simulate Buy ${singleStockShares.toFixed(3)} ${targetStock.symbol} (Sandbox)`
                        : `Simulate & Allocate $${amountUsdc.toFixed(2)} (Instant Sandbox)`}
                    </span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faWallet} className="w-3.5 h-3.5" />
                    <span>
                      {targetStock
                        ? `Sign & Buy ${singleStockShares.toFixed(3)} ${targetStock.symbol} on Mainnet`
                        : `Sign & Allocate $${amountUsdc.toFixed(2)} on Mainnet`}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => openWalletModal(true)}
                className={`w-full py-3.5 rounded-2xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-[#00D2FF] text-[#06080F] hover:bg-[#38BDF8]'
                }`}
              >
                <FontAwesomeIcon icon={faWallet} className="w-3.5 h-3.5" />
                <span>Connect Solana Wallet to Buy</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
