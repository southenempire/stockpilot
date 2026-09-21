import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { derivePortfolioVaultPda } from '@/lib/solana/vault-program';

const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Official Circle Devnet USDC
const AAPLX_MINT = 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  try {
    const owner = new PublicKey(address);
    const rpcUrl =
      process.env.HELIUS_DEVNET_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      'https://api.devnet.solana.com';
    const conn = new Connection(rpcUrl, 'confirmed');

    // 1. Fetch SOL Balance
    const lamports = await conn.getBalance(owner);
    const solBalance = lamports / 1e9;

    // 2. Fetch Vault PDA Balance
    let vaultSol = 0;
    try {
      const [vaultPda] = derivePortfolioVaultPda(owner);
      const vLamports = await conn.getBalance(vaultPda);
      vaultSol = vLamports / 1e9;
    } catch (e) {
      console.warn('Vault query error:', e);
    }

    // 3. Fetch Token Accounts (USDC & Stocks like AAPLx)
    let usdcBalance = 0;
    const stocks: Record<string, number> = {};

    try {
      const tokenProg = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const token2022Prog = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

      const [resStandard, res2022] = await Promise.allSettled([
        conn.getParsedTokenAccountsByOwner(owner, { programId: tokenProg }),
        conn.getParsedTokenAccountsByOwner(owner, { programId: token2022Prog }),
      ]);

      const allAccounts = [
        ...(resStandard.status === 'fulfilled' ? resStandard.value.value : []),
        ...(res2022.status === 'fulfilled' ? res2022.value.value : []),
      ];

      for (const item of allAccounts) {
        const info = item.account.data.parsed.info;
        const mint = info.mint;
        const uiAmount = info.tokenAmount.uiAmount || 0;

        if (mint === USDC_MINT) {
          usdcBalance += uiAmount;
        } else if (mint === AAPLX_MINT) {
          stocks['AAPLx'] = (stocks['AAPLx'] || 0) + uiAmount;
        }
      }
    } catch (tokenErr) {
      console.warn('Server token query error:', tokenErr);
    }

    return NextResponse.json({
      success: true,
      address,
      sol: solBalance,
      usdc: usdcBalance,
      vaultSol,
      stocks,
    });
  } catch (err: any) {
    console.error('Wallet balances API error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch balances' }, { status: 500 });
  }
}
