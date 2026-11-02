import { NextRequest, NextResponse } from 'next/server';
import { AuthConfigError, setSessionCookie, verifyChallenge } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const address = verifyChallenge(await req.json());
    const res = NextResponse.json({ success: true, address });
    setSessionCookie(res, address);
    return res;
  } catch (err) {
    const status = err instanceof AuthConfigError ? 503 : 401;
    return NextResponse.json({ success: false, error: (err instanceof Error && err.message) || 'Sign-in failed' }, { status });
  }
}
