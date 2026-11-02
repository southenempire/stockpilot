import { NextRequest, NextResponse } from 'next/server';
import { AuthConfigError, createChallenge } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    return NextResponse.json({ success: true, ...createChallenge(address) });
  } catch (err) {
    const status = err instanceof AuthConfigError ? 503 : 400;
    return NextResponse.json({ success: false, error: (err instanceof Error && err.message) || 'Bad request' }, { status });
  }
}
