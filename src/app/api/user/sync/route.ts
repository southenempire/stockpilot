import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/server/db';
import { hashUserId, sanitizeString } from '@/lib/server/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawIdentifier, authProvider, displayName, settings } = body;

    if (!rawIdentifier || typeof rawIdentifier !== 'string') {
      return NextResponse.json(
        { success: false, error: 'rawIdentifier is required' },
        { status: 400 }
      );
    }

    const hashedId = hashUserId(rawIdentifier);
    const provider = sanitizeString(authProvider || 'solana_wallet', 32);
    const name = sanitizeString(displayName || '', 64);
    const settingsStr = settings ? JSON.stringify(settings) : null;
    const now = Date.now();

    const db = getDatabase();

    // Check if user exists
    const userStmt = db.prepare('SELECT * FROM users WHERE hashed_id = ?');
    const existingUser = userStmt.get(hashedId) as any;

    if (!existingUser) {
      const insertStmt = db.prepare(`
        INSERT INTO users (hashed_id, auth_provider, display_name, created_at, last_active_at, settings_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(hashedId, provider, name, now, now, settingsStr);
    } else {
      const updateStmt = db.prepare(`
        UPDATE users 
        SET last_active_at = ?, display_name = COALESCE(NULLIF(?, ''), display_name)
        WHERE hashed_id = ?
      `);
      updateStmt.run(now, name, hashedId);
    }

    // Fetch user's custom strategies
    const stratStmt = db.prepare(
      'SELECT * FROM custom_strategies WHERE user_hashed_id = ? ORDER BY created_at DESC'
    );
    const strategies = (stratStmt.all(hashedId) as any[]).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      targetWeights: JSON.parse(s.target_weights_json || '{}'),
      createdAt: s.created_at,
    }));

    // Fetch user's recent activity
    const actStmt = db.prepare(
      'SELECT * FROM activity_logs WHERE user_hashed_id = ? ORDER BY created_at DESC LIMIT 25'
    );
    const recentActivity = actStmt.all(hashedId);

    return NextResponse.json({
      success: true,
      hashedId,
      user: {
        hashedId,
        provider,
        displayName: name || (existingUser ? existingUser.display_name : ''),
        createdAt: existingUser ? existingUser.created_at : now,
        lastActiveAt: now,
      },
      strategies,
      recentActivity,
    });
  } catch (error: any) {
    console.error('API /api/user/sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
