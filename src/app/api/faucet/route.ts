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

export async function POST(request: Request) {
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
