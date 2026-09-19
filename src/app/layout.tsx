import type { Metadata } from 'next';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import SolanaWalletProvider from '@/components/SolanaWalletProvider';
import PrivyWalletProvider from '@/components/PrivyWalletProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://stockpilotsol.xyz'),
  title: 'StockPilot | Autonomous 24/7 AI Stock Robo-Advisor on Solana',
  description: '1-Tap Algorithmic Thematic Stock Baskets with Autonomous AI Rebalancing on Solana Devnet. Invest and trade tokenized US equities 24/7.',
  openGraph: {
    title: 'StockPilot — Autonomous 24/7 AI Stock Robo-Advisor on Solana',
    description: '1-Tap Thematic Stock Baskets with Autonomous AI Rebalancing on Solana Devnet.',
    images: ['/stockpilot_logo.jpg'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
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
      </body>
    </html>
  );
}
