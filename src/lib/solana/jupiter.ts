/**
 * Jupiter DEX Aggregator Integration Service
 * Official Documentation: https://developers.jup.ag/docs/ai
 */

export const JUPITER_API_KEY =
  process.env.NEXT_PUBLIC_JUPITER_API_KEY ||
  process.env.JUPITER_API_KEY ||
  'jup_43cc9d430156ec52867fa7a4a5cf71afe854f2039733143edc0acfd9b30bfcbe';

export const JUPITER_BASE_URL = 'https://api.jup.ag/swap/v1';
export const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';

// Standard Solana Mint Addresses
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // in atomic units / lamports
  slippageBps?: number; // e.g. 50 = 0.5%
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  } | null;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

/**
 * Fetch optimal swap quote from Jupiter DEX Aggregator
 */
export async function getJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = 50,
}: JupiterQuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    const url = new URL(`${JUPITER_BASE_URL}/quote`);
    url.searchParams.append('inputMint', inputMint);
    url.searchParams.append('outputMint', outputMint);
    url.searchParams.append('amount', Math.floor(amount).toString());
    url.searchParams.append('slippageBps', slippageBps.toString());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Jupiter Quote notice (${response.status}):`, errText);
      return null;
    }

    const data = await response.json();
    return data as JupiterQuoteResponse;
  } catch (error) {
    console.warn('Jupiter quote fetch error:', error);
    return null;
  }
}

/**
 * Build serialized versioned transaction from Jupiter quote
 */
export async function buildJupiterSwapTransaction(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string,
  feeAccount?: string
): Promise<{ swapTransaction: string; lastValidBlockHeight?: number } | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY;
    }

    const body: Record<string, any> = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    };

    if (feeAccount) {
      body.feeAccount = feeAccount;
    }

    const response = await fetch(`${JUPITER_BASE_URL}/swap`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Jupiter Swap build notice (${response.status}):`, errText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Jupiter build swap error:', error);
    return null;
  }
}

/**
 * Query real-time token prices via Jupiter Price API v2
 */
export async function getJupiterTokenPrices(
  mints: string[]
): Promise<Record<string, { id: string; price: string }>> {
  try {
    const url = `${JUPITER_PRICE_URL}?ids=${mints.join(',')}`;
    const headers: Record<string, string> = {};
    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return {};
    const data = await res.json();
    return data?.data || {};
  } catch {
    return {};
  }
}
