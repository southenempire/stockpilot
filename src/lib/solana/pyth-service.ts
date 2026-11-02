/**
 * Pyth Network Real-Time Oracle Service
 * Provides sub-second real-time US Equity & Crypto price feeds via Pyth Hermes API.
 * Documentation: https://docs.pyth.network/price-feeds
 */

export interface PythPriceData {
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  expo: number;
  formattedPrice: string;
  /** True when Hermes gave no price and the hard-coded benchmark was used instead. */
  isFallback: boolean;
}

// Official Pyth Network Price Feed Identifiers (Mainnet & Hermes)
export const PYTH_PRICE_FEED_IDS: Record<string, { id: string; ticker: string; fallbackPrice: number }> = {
  xNVDA: {
    id: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
    ticker: 'Equity.US.NVDA/USD',
    fallbackPrice: 128.45,
  },
  xAAPL: {
    id: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    ticker: 'Equity.US.AAPL/USD',
    fallbackPrice: 224.10,
  },
  xMSFT: {
    id: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
    ticker: 'Equity.US.MSFT/USD',
    fallbackPrice: 432.80,
  },
  xTSLA: {
    id: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    ticker: 'Equity.US.TSLA/USD',
    fallbackPrice: 238.90,
  },
  xAMZN: {
    id: 'b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
    ticker: 'Equity.US.AMZN/USD',
    fallbackPrice: 186.20,
  },
  xGOOGL: {
    id: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
    ticker: 'Equity.US.GOOGL/USD',
    fallbackPrice: 165.75,
  },
  xAMD: {
    id: '3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e',
    ticker: 'Equity.US.AMD/USD',
    fallbackPrice: 154.60,
  },
  xTSM: {
    id: 'e722560a66e4ab00522ef20a38fa2ba5d1b41f1c5404723ed895d202a7af7cc4',
    ticker: 'Equity.US.TSM/USD',
    fallbackPrice: 172.30,
  },
  xCOIN: {
    id: 'fee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245',
    ticker: 'Equity.US.COIN/USD',
    fallbackPrice: 215.40,
  },
  xJNJ: {
    id: '12848738d5db3aef52f51d78d98fc8b8b8450ffb19fb3aeeb67d38f8c147ff63',
    ticker: 'Equity.US.JNJ/USD',
    fallbackPrice: 162.80,
  },
  xPG: {
    id: 'ad2fda41998f4e7be99a2a7b27273bd16f183d9adfc014a4f5e5d3d6cd519bf4',
    ticker: 'Equity.US.PG/USD',
    fallbackPrice: 171.10,
  },
  SOL: {
    id: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    ticker: 'Crypto.SOL/USD',
    fallbackPrice: 152.40,
  },
  USDC: {
    id: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    ticker: 'Crypto.USDC/USD',
    fallbackPrice: 1.00,
  }
};

// Public Hermes now answers `unauthorized` to price requests; point PYTH_HERMES_URL at a
// keyed Hermes endpoint (it replaces everything before `/v2/...`) to get live prices.
const PYTH_HERMES_BASE = `${(process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network').replace(/\/+$/, '')}/v2/updates/price/latest`;

/**
 * Fetches real-time price updates for all supported tokenized equities from Pyth Network.
 * Falls back safely to benchmark cached prices if offline or during market closures.
 */
export async function fetchPythPrices(): Promise<Record<string, PythPriceData>> {
  const results: Record<string, PythPriceData> = {};

  // Build query with all feed IDs
  const feedEntries = Object.entries(PYTH_PRICE_FEED_IDS);
  const idsQuery = feedEntries.map(([, info]) => `ids[]=${info.id}`).join('&');
  const url = `${PYTH_HERMES_BASE}?${idsQuery}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 10 } // Next.js cache policy: revalidate every 10s
    });

    if (res.ok) {
      const data = await res.json();
      const parsedFeeds: any[] = data?.parsed || [];

      // Map response by feed ID
      const feedMap = new Map<string, any>();
      for (const item of parsedFeeds) {
        if (item.id) {
          // Normalize feed ID (remove 0x if present)
          const cleanId = item.id.replace(/^0x/, '').toLowerCase();
          feedMap.set(cleanId, item);
        }
      }

      for (const [symbol, info] of feedEntries) {
        const cleanTargetId = info.id.toLowerCase();
        const pythItem = feedMap.get(cleanTargetId);

        if (pythItem && pythItem.price) {
          const rawPrice = Number(pythItem.price.price);
          const expo = Number(pythItem.price.expo);
          const conf = Number(pythItem.price.conf || 0);
          const publishTime = Number(pythItem.price.publish_time || Date.now() / 1000);

          const computedPrice = rawPrice * Math.pow(10, expo);

          if (computedPrice > 0) {
            results[symbol] = {
              symbol,
              price: Number(computedPrice.toFixed(2)),
              confidence: Number((conf * Math.pow(10, expo)).toFixed(4)),
              publishTime,
              expo,
              formattedPrice: `$${computedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              isFallback: false,
            };
            continue;
          }
        }

        // Fallback if specific item was missing
        results[symbol] = {
          symbol,
          price: info.fallbackPrice,
          confidence: 0.01,
          publishTime: Math.floor(Date.now() / 1000),
          expo: -2,
          formattedPrice: `$${info.fallbackPrice.toFixed(2)}`,
          isFallback: true,
        };
      }

      return results;
    }
  } catch (err) {
    console.warn('Pyth Hermes API unavailable, using benchmark fallbacks:', err);
  }

  // Graceful fallback for all
  for (const [symbol, info] of feedEntries) {
    results[symbol] = {
      symbol,
      price: info.fallbackPrice,
      confidence: 0.01,
      publishTime: Math.floor(Date.now() / 1000),
      expo: -2,
      formattedPrice: `$${info.fallbackPrice.toFixed(2)}`,
      isFallback: true,
    };
  }

  return results;
}
