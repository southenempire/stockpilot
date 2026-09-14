import type { Metadata } from 'next';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import SolanaWalletProvider from '@/components/SolanaWalletProvider';
import PrivyWalletProvider from '@/components/PrivyWalletProvider';

export const metadata: Metadata = {
  metadataBase: new URL('https://stockpilot.trade'),
  title: 'StockPilot | Autonomous 24/7 AI Stock Robo-Advisor on Solana',
  description: '1-Tap Algorithmic Thematic Stock Baskets with Autonomous AI Rebalancing on Solana Mainnet. Invest and trade tokenized US equities 24/7.',
  openGraph: {
    title: 'StockPilot — Autonomous 24/7 AI Stock Robo-Advisor on Solana',
    description: '1-Tap Thematic Stock Baskets with Autonomous AI Rebalancing on Solana Mainnet.',
    images: ['/stockpilot_logo.jpg'],
  },
  icons: {
    icon: '/stockpilot_logo.jpg',
    apple: '/stockpilot_logo.jpg',
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
