import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const HELIUS_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://devnet.helius-rpc.com/?api-key=afac2f74-f3f4-4bd2-9e0e-f53695767c64';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Solana wallet address is required' },
        { status: 400 }
      );
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana wallet address format' },
        { status: 400 }
      );
    }

    const conn = new Connection(HELIUS_RPC, 'confirmed');

    // Check current balance first
    let currentSol = 0;
    try {
      const lamports = await conn.getBalance(recipientPubkey);
      currentSol = lamports / LAMPORTS_PER_SOL;
    } catch {
      // ignore
    }

    // Check USDC balance
    let currentUsdc = 0;
    try {
      const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
      const tokenProg = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const res = await conn.getParsedTokenAccountsByOwner(recipientPubkey, { programId: tokenProg });
      for (const item of res.value) {
        const info = item.account.data.parsed.info;
        if (info.mint === USDC_MINT) {
          currentUsdc += info.tokenAmount.uiAmount || 0;
        }
      }
    } catch {
      // ignore
    }

    // Attempt on-chain 1 SOL Devnet airdrop via Helius
    let txSig = '';
    let airdropSuccess = false;
    let airdropError = '';

    try {
      txSig = await conn.requestAirdrop(recipientPubkey, 1 * LAMPORTS_PER_SOL);
      const latestBlockhash = await conn.getLatestBlockhash('confirmed');
      await conn.confirmTransaction(
        {
          signature: txSig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );
      airdropSuccess = true;

      // Re-check balance after successful airdrop
      try {
        const lamports = await conn.getBalance(recipientPubkey);
        currentSol = lamports / LAMPORTS_PER_SOL;
      } catch {
        currentSol += 1.0;
      }
    } catch (heliusErr: any) {
      const msg = heliusErr?.message || '';
      console.warn('[Faucet] Helius airdrop failed:', msg);

      // Try public devnet endpoint as fallback
      try {
        const fallbackConn = new Connection('https://api.devnet.solana.com', 'confirmed');
        txSig = await fallbackConn.requestAirdrop(recipientPubkey, 1 * LAMPORTS_PER_SOL);
        const bh = await fallbackConn.getLatestBlockhash('confirmed');
        await fallbackConn.confirmTransaction(
          {
            signature: txSig,
            blockhash: bh.blockhash,
            lastValidBlockHeight: bh.lastValidBlockHeight,
          },
          'confirmed'
        );
        airdropSuccess = true;

        try {
          const lamports = await conn.getBalance(recipientPubkey);
          currentSol = lamports / LAMPORTS_PER_SOL;
        } catch {
          currentSol += 1.0;
        }
      } catch (fallbackErr: any) {
        const fbMsg = fallbackErr?.message || '';
        console.warn('[Faucet] Public devnet airdrop also failed:', fbMsg);

        if (msg.includes('Rate limit') || msg.includes('429') || fbMsg.includes('429') || fbMsg.includes('limit')) {
          airdropError = 'rate_limited';
        } else {
          airdropError = msg || fbMsg || 'Airdrop request failed';
        }
      }
    }

    // Return honest result
    if (airdropSuccess) {
      return NextResponse.json({
        success: true,
        airdropSuccess: true,
        solAirdropped: 1.0,
        currentSolBalance: currentSol,
        currentUsdcBalance: currentUsdc,
        txSignature: txSig,
        explorerUrl: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
        message: `Successfully airdropped 1.0 Devnet SOL! Your balance: ${currentSol.toFixed(3)} SOL, ${currentUsdc.toFixed(2)} USDC`,
      });
    } else {
      // Be honest — don't fake a success
      return NextResponse.json({
        success: false,
        airdropSuccess: false,
        solAirdropped: 0,
        currentSolBalance: currentSol,
        currentUsdcBalance: currentUsdc,
        txSignature: '',
        explorerUrl: `https://explorer.solana.com/address/${address}?cluster=devnet`,
        error: airdropError === 'rate_limited'
          ? `Devnet faucet rate-limited (max 1 SOL/day). Your current balance: ${currentSol.toFixed(3)} SOL, ${currentUsdc.toFixed(2)} USDC. Use Circle Faucet or Solana Web Faucet for more tokens.`
          : `Airdrop failed: ${airdropError}. Your current balance: ${currentSol.toFixed(3)} SOL, ${currentUsdc.toFixed(2)} USDC.`,
        message: airdropError === 'rate_limited'
          ? `Rate limited — you already have ${currentSol.toFixed(3)} SOL & ${currentUsdc.toFixed(2)} USDC on Devnet. Use Circle or Solana faucet links below for more.`
          : `Airdrop failed. Current balance: ${currentSol.toFixed(3)} SOL, ${currentUsdc.toFixed(2)} USDC.`,
      });
    }
  } catch (err: any) {
    console.error('[Faucet] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process faucet airdrop' },
      { status: 500 }
    );
  }
}
