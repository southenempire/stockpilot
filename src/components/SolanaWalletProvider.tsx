'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  // Configured for Solana Mainnet Production
  const network = WalletAdapterNetwork.Mainnet;
  
  // High availability Mainnet Helius RPC endpoint
  const endpoint = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      'https://mainnet.helius-rpc.com/?api-key=afac2f74-f3f4-4bd2-9e0e-f53695767c64'
    );
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  // Global wallet error handler to prevent Next.js dev overlay crashes
  const onError = useCallback((error: WalletError) => {
    // Expected operational errors (e.g. user rejection, account desync, signature timeouts)
    console.warn('[StockPilot Wallet Provider] Handled wallet event:', error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
