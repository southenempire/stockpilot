import { NextResponse } from 'next/server';
import { fetchPythPrices } from '@/lib/solana/pyth-service';

export const dynamic = 'force-dynamic';
export const revalidate = 10;

export async function GET() {
  try {
    const prices = await fetchPythPrices();
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      prices,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Pyth oracle prices' },
      { status: 500 }
    );
  }
}
