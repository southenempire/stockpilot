import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionAddress } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, address: getSessionAddress(req) });
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
