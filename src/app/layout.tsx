import type { Metadata } from 'next';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import SolanaWalletProvider from '@/components/SolanaWalletProvider';
import PrivyWalletProvider from '@/components/PrivyWalletProvider';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://stockpilotsol.xyz'),
  title: 'StockPilot | Autonomous 24/7 AI Stock Robo-Advisor on Solana',
  description: 'Trade tokenized US equities 24/7. 1-tap thematic stock baskets with autonomous AI rebalancing, non-custodial Anchor PDA vaults, and sub-cent Solana gas.',
  keywords: ['solana', 'robo-advisor', 'tokenized stocks', 'defi', 'autonomous trading', 'anchor vault', 'stockpilot'],
  openGraph: {
    type: 'website',
    url: 'https://stockpilotsol.xyz',
    siteName: 'StockPilot',
    title: 'StockPilot — Autonomous 24/7 AI Stock Robo-Advisor on Solana',
    description: 'Trade tokenized US equities 24/7. Non-custodial Anchor PDA vaults. Sub-cent Solana gas. Zero management fees.',
    images: [
      {
        url: '/anime-city-bg.jpg',
        width: 1920,
        height: 1080,
        alt: 'StockPilot — Autonomous Stock Trading on Solana',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@StockPilotSOL',
    creator: '@StockPilotSOL',
    title: 'StockPilot — Autonomous 24/7 AI Stock Robo-Advisor on Solana',
    description: 'Trade tokenized US equities 24/7. Non-custodial Anchor PDA vaults. Sub-cent Solana gas.',
    images: ['/anime-city-bg.jpg'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col antialiased">
        <PrivyWalletProvider>
          <SolanaWalletProvider>
            {children}
          </SolanaWalletProvider>
        </PrivyWalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
