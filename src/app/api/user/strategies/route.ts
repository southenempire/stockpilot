import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/server/db';
import { hashUserId, sanitizeString } from '@/lib/server/security';
import {
  isSupabaseConfigured,
  getSupabaseCustomStrategies,
  saveSupabaseCustomStrategy,
  upsertSupabaseUser,
} from '@/lib/server/supabase';
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

    // Prefer Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await getSupabaseCustomStrategies(hashedId);
        if (!error && data) {
          const strategies = data.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            targetWeights: JSON.parse(s.target_weights_json || '{}'),
            createdAt: Number(s.created_at),
            updatedAt: Number(s.updated_at),
          }));
          return NextResponse.json({ success: true, strategies, source: 'supabase' });
        }
      } catch (sbErr) {
        console.warn('Supabase strategies GET fallback to SQLite:', sbErr);
      }
    }

    const db = getDatabase();
    const stratStmt = db.prepare(
      'SELECT * FROM custom_strategies WHERE user_hashed_id = ? ORDER BY created_at DESC'
    );
    const rows = stratStmt.all(hashedId) as any[];

    const strategies = rows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      targetWeights: JSON.parse(s.target_weights_json || '{}'),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return NextResponse.json({ success: true, strategies, source: 'sqlite' });
  } catch (error: any) {
    console.error('API /api/user/strategies GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawIdentifier, strategy } = body;

    if (!rawIdentifier || !strategy || !strategy.name) {
      return NextResponse.json(
        { success: false, error: 'rawIdentifier and strategy object are required' },
        { status: 400 }
      );
    }

    const hashedId = hashUserId(rawIdentifier);
    const name = sanitizeString(strategy.name, 64);
    const description = sanitizeString(strategy.description || '', 255);
    const targetWeightsJson = JSON.stringify(strategy.targetWeights || {});
    const now = Date.now();
    const id = strategy.id || `strat_${randomUUID().slice(0, 8)}`;

    // Prefer Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        await upsertSupabaseUser({
          hashedId,
          authProvider: 'solana_wallet',
          displayName: '',
          now,
        });

        await saveSupabaseCustomStrategy({
          id,
          userHashedId: hashedId,
          name,
          description,
          targetWeightsJson,
          createdAt: now,
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          source: 'supabase',
          strategy: {
            id,
            name,
            description,
            targetWeights: strategy.targetWeights || {},
            createdAt: now,
            updatedAt: now,
          },
        });
      } catch (sbErr) {
        console.warn('Supabase strategies POST fallback to SQLite:', sbErr);
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

    const insertStrat = db.prepare(`
      INSERT OR REPLACE INTO custom_strategies (id, user_hashed_id, name, description, target_weights_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertStrat.run(id, hashedId, name, description, targetWeightsJson, now, now);

    return NextResponse.json({
      success: true,
      source: 'sqlite',
      strategy: {
        id,
        name,
        description,
        targetWeights: strategy.targetWeights || {},
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error: any) {
    console.error('API /api/user/strategies POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
