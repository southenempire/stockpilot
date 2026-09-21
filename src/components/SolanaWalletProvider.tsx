'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  // Configured for Solana Devnet
  const network = WalletAdapterNetwork.Devnet;
  
  const endpoint = useMemo(() => {
    let url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network);
    if (url.includes('mainnet')) {
      url = url.replace('mainnet.helius-rpc.com', 'devnet.helius-rpc.com');
      if (url.includes('mainnet')) {
        url = clusterApiUrl(network);
      }
    }
    return url;
  }, [network]);

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
