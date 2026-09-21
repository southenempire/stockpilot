import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let rawRpcUrl =
  process.env.HELIUS_DEVNET_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.devnet.solana.com";

if (rawRpcUrl.includes("mainnet")) {
  rawRpcUrl = rawRpcUrl.replace("mainnet.helius-rpc.com", "devnet.helius-rpc.com");
  if (rawRpcUrl.includes("mainnet")) {
    rawRpcUrl = "https://api.devnet.solana.com";
  }
}

const DEVNET_RPC_URL = rawRpcUrl;
const DEVNET_SOL_LAMPORTS = 1_000_000_000;

// --- IP Rate Limiter: 1 airdrop per IP per 60 seconds ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const ipLastRequest = new Map<string, number>();

// Periodically clean up stale entries so Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of ipLastRequest.entries()) {
    if (now - ts > RATE_LIMIT_WINDOW_MS * 2) ipLastRequest.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS * 5);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function POST(request: Request) {
  // Rate-limit check
  const ip = getClientIp(request);
  const now = Date.now();
  const lastTs = ipLastRequest.get(ip);

  if (lastTs && now - lastTs < RATE_LIMIT_WINDOW_MS) {
    const secondsLeft = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastTs)) / 1000);
    return NextResponse.json(
      {
        error: "Rate limited",
        message: `Faucet cooldown active. Try again in ${secondsLeft}s. For more devnet SOL, use https://faucet.solana.com`,
        retryAfterSeconds: secondsLeft,
      },
      { status: 429 }
    );
  }

  let body: { address?: string; wallet?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body. Provide a Solana Devnet address" },
      { status: 400 }
    );
  }

  const wallet = (body.address || body.wallet)?.trim();

  if (!wallet) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  try {
    const rpcResponse = await fetch(DEVNET_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "requestAirdrop",
        params: [wallet, DEVNET_SOL_LAMPORTS],
      }),
      cache: "no-store",
    });

    const rpcResult = await rpcResponse.json();

    if (!rpcResponse.ok || rpcResult.error) {
      return NextResponse.json(
        {
          error: "Airdrop failed",
          message: rpcResult.error?.message ?? "RPC rejected airdrop (rate-limited). For additional devnet tokens, use https://faucet.solana.com",
          network: "devnet",
        },
        { status: 502 }
      );
    }

    // Record successful request for rate limiting
    ipLastRequest.set(ip, now);

    const txSig = rpcResult.result;

    return NextResponse.json({
      success: true,
      signature: txSig,
      txSignature: txSig,
      explorerUrl: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
      network: "devnet",
      amount: 1,
      solAirdropped: 1,
      message: "1 Devnet SOL airdropped. (Devnet SOL only; USDC obtained separately via Circle Faucet)",
    });
  } catch {
    return NextResponse.json(
      { error: "Devnet RPC unreachable, try again shortly" },
      { status: 502 }
    );
  }
}
