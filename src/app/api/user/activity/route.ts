import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/server/db';
import { hashUserId, sanitizeString } from '@/lib/server/security';
import { randomUUID } from 'node:crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawIdentifier = searchParams.get('rawIdentifier');

    if (!rawIdentifier) {
      return NextResponse.json(
        { success: false, error: 'rawIdentifier query param is required' },
        { status: 400 }
      );
    }

    const hashedId = hashUserId(rawIdentifier);
    const db = getDatabase();
    const actStmt = db.prepare(
      'SELECT * FROM activity_logs WHERE user_hashed_id = ? ORDER BY created_at DESC LIMIT 50'
    );
    const activity = actStmt.all(hashedId);

    return NextResponse.json({ success: true, activity });
  } catch (error: any) {
    console.error('API /api/user/activity GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawIdentifier, activityType, asset, amount, txSignature, reason } = body;

    if (!rawIdentifier || !activityType) {
      return NextResponse.json(
        { success: false, error: 'rawIdentifier and activityType are required' },
        { status: 400 }
      );
    }

    const hashedId = hashUserId(rawIdentifier);
    const actType = sanitizeString(activityType, 32);
    const actAsset = sanitizeString(asset || 'USDC', 16);
    const actAmount = parseFloat(amount) || 0;
    const sig = sanitizeString(txSignature || '', 128);
    const actReason = sanitizeString(reason || '', 255);
    const now = Date.now();
    const id = `act_${randomUUID().slice(0, 8)}`;

    // Validate transaction signature format if provided
    if (sig) {
      const isBase58Sig = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(sig);
      const isDemoSig = sig.startsWith('sim_') || sig.startsWith('demo_');
      if (!isBase58Sig && !isDemoSig) {
        return NextResponse.json(
          { success: false, error: 'Invalid Solana transaction signature format' },
          { status: 400 }
        );
      }
    }

    const db = getDatabase();

    // Ensure user exists first
    const userCheck = db.prepare('SELECT hashed_id FROM users WHERE hashed_id = ?');
    if (!userCheck.get(hashedId)) {
      const insertUser = db.prepare(`
        INSERT INTO users (hashed_id, auth_provider, display_name, created_at, last_active_at)
        VALUES (?, 'solana_wallet', '', ?, ?)
      `);
      insertUser.run(hashedId, now, now);
    }

    const insertAct = db.prepare(`
      INSERT INTO activity_logs (id, user_hashed_id, activity_type, asset, amount, tx_signature, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAct.run(id, hashedId, actType, actAsset, actAmount, sig, actReason, now);

    return NextResponse.json({
      success: true,
      log: {
        id,
        activityType: actType,
        asset: actAsset,
        amount: actAmount,
        txSignature: sig,
        reason: actReason,
        createdAt: now,
      },
    });
  } catch (error: any) {
    console.error('API /api/user/activity POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
