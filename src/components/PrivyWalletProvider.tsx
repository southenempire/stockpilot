'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

interface PrivyWalletProviderProps {
  children: React.ReactNode;
}

export default function PrivyWalletProvider({ children }: PrivyWalletProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmu0cpnlc01ox0cldzjlg0p1f';

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#00D2FF',
          showWalletLoginFirst: false,
          walletChainType: 'solana-only',
        },
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
