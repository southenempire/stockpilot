import { Stock } from '@/types/stock';

export const SUPPORTED_STOCKS: Record<string, Stock> = {
  xNVDA: {
    symbol: 'xNVDA',
    name: 'NVIDIA Corporation',
    category: 'Semiconductors',
    price: 128.45,
    change24h: 4.82,
    marketCap: '$3.15T',
    peRatio: 42.1,
    iconBg: '#76B900',
    description: 'AI hardware leader powering frontier deep learning infrastructure and data centers worldwide.'
  },
  xAAPL: {
    symbol: 'xAAPL',
    name: 'Apple Inc.',
    category: 'Megacap',
    price: 224.10,
    change24h: 1.15,
    marketCap: '$3.42T',
    peRatio: 33.8,
    iconBg: '#A2AAAD',
    description: 'Global consumer electronics powerhouse with unmatched ecosystem loyalty and services margin.'
  },
  xMSFT: {
    symbol: 'xMSFT',
    name: 'Microsoft Corporation',
    category: 'Tech & AI',
    price: 432.80,
    change24h: 2.30,
    marketCap: '$3.22T',
    peRatio: 36.4,
    iconBg: '#00A4EF',
    description: 'Dominant enterprise cloud (Azure) and productivity suite infused with multi-model AI workflows.'
  },
  xTSLA: {
    symbol: 'xTSLA',
    name: 'Tesla, Inc.',
    category: 'High Beta',
    price: 238.90,
    change24h: -1.75,
    marketCap: '$760B',
    peRatio: 64.2,
    iconBg: '#E82127',
    description: 'Autonomous robotics, next-gen energy storage, and electric mobility frontrunner.'
  },
  xAMZN: {
    symbol: 'xAMZN',
    name: 'Amazon.com, Inc.',
    category: 'Megacap',
    price: 186.20,
    change24h: 1.85,
    marketCap: '$1.94T',
    peRatio: 40.5,
    iconBg: '#FF9900',
    description: 'Global e-commerce backbone and premier hyperscaler cloud platform (AWS).'
  },
  xGOOGL: {
    symbol: 'xGOOGL',
    name: 'Alphabet Inc.',
    category: 'Tech & AI',
    price: 165.75,
    change24h: 0.90,
    marketCap: '$2.05T',
    peRatio: 24.1,
    iconBg: '#4285F4',
    description: 'Monopolistic search engine, YouTube network, and creator of the Gemini AI foundation models.'
  },
  xTSM: {
    symbol: 'xTSM',
    name: 'Taiwan Semiconductor Mfg.',
    category: 'Semiconductors',
    price: 172.30,
    change24h: 3.40,
    marketCap: '$890B',
    peRatio: 28.5,
    iconBg: '#D32F2F',
    description: 'The world’s indispensable foundry fabricator manufacturing all leading-edge 3nm & 2nm chips.'
  },
  xAMD: {
    symbol: 'xAMD',
    name: 'Advanced Micro Devices',
    category: 'Semiconductors',
    price: 154.60,
    change24h: 2.95,
    marketCap: '$250B',
    peRatio: 48.0,
    iconBg: '#ED1C24',
    description: 'High-performance computing and GPU competitor expanding datacenter AI accelerators.'
  },
  xCOIN: {
    symbol: 'xCOIN',
    name: 'Coinbase Global, Inc.',
    category: 'High Beta',
    price: 215.40,
    change24h: 6.10,
    marketCap: '$52B',
    peRatio: 38.2,
    iconBg: '#0052FF',
    description: 'The primary regulated US gateway for on-chain finance, custody, and stablecoin infrastructure.'
  },
  xJNJ: {
    symbol: 'xJNJ',
    name: 'Johnson & Johnson',
    category: 'Consumer & Dividend',
    price: 162.80,
    change24h: 0.45,
    marketCap: '$390B',
    peRatio: 16.5,
    iconBg: '#D51900',
    description: 'Healthcare & pharmaceutical dividend titan with 60+ consecutive years of payout growth.'
  },
  xPG: {
    symbol: 'xPG',
    name: 'Procter & Gamble Co.',
    category: 'Consumer & Dividend',
    price: 171.10,
    change24h: 0.30,
    marketCap: '$405B',
    peRatio: 26.2,
    iconBg: '#003CAE',
    description: 'Consumer defensive staple offering recession-proof cash flow and reliable compound yield.'
  }
};
