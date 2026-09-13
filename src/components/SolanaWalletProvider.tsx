'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  // Configured for Solana Mainnet Production
  const network = WalletAdapterNetwork.Mainnet;
  
  // High availability Mainnet RPC endpoint (public mainnet clusterApiUrl returns 403 in browsers)
  const endpoint = useMemo(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    // High-performance public RPCs that permit browser CORS and standard RPC methods
    return 'https://solana-rpc.publicnode.com';
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
