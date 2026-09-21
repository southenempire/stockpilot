import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTransaction = body?.rawTransaction;

    if (!rawTransaction) {
      return NextResponse.json(
        { success: false, error: 'Missing rawTransaction in request body' },
        { status: 400 }
      );
    }

    let rpcUrl =
      process.env.HELIUS_DEVNET_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      'https://api.devnet.solana.com';

    if (rpcUrl.includes('mainnet')) {
      rpcUrl = rpcUrl.replace('mainnet.helius-rpc.com', 'devnet.helius-rpc.com');
      if (rpcUrl.includes('mainnet')) {
        rpcUrl = 'https://api.devnet.solana.com';
      }
    }

    const conn = new Connection(rpcUrl, 'confirmed');
    const txBuffer = Buffer.from(rawTransaction, 'base64');

    const signature = await conn.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (err: any) {
    console.error('[SendTx Relay Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
