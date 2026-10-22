/**
 * Supabase PostgREST client for StockPilot serverless backend.
 * Uses native fetch for zero-dependency, edge-compatible, high-performance database queries.
 */

interface SupabaseConfig {
  url: string;
  key: string;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  // Remove trailing slash if present
  const cleanUrl = url.replace(/\/+$/, '');
  return { url: cleanUrl, key };
}

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig() !== null;
};

async function supabaseFetch<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    prefer?: string;
  } = {}
): Promise<{ data: T | null; error: any }> {
  const config = getSupabaseConfig();
  if (!config) {
    return { data: null, error: new Error('Supabase is not configured') };
  }

  const { method = 'GET', body, headers = {}, prefer } = options;
  const requestHeaders: Record<string, string> = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    ...headers,
  };

  if (prefer) {
    requestHeaders['Prefer'] = prefer;
  }

  try {
    const res = await fetch(`${config.url}/rest/v1/${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return { data: null, error: new Error(`Supabase error ${res.status}: ${errText}`) };
    }

    // Some operations with return=minimal have no json
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

// ==========================================
// User Operations
// ==========================================

export async function upsertSupabaseUser(user: {
  hashedId: string;
  authProvider: string;
  displayName: string;
  now: number;
  settingsJson?: string | null;
}) {
  const { data: existing } = await supabaseFetch<any[]>(
    `users?hashed_id=eq.${encodeURIComponent(user.hashedId)}&select=*`
  );

  if (existing && existing.length > 0) {
    // Update last_active_at
    const updatePayload: any = { last_active_at: user.now };
    if (user.displayName) {
      updatePayload.display_name = user.displayName;
    }
    return supabaseFetch(
      `users?hashed_id=eq.${encodeURIComponent(user.hashedId)}`,
      {
        method: 'PATCH',
        body: updatePayload,
      }
    );
  } else {
    // Insert new user
    return supabaseFetch('users', {
      method: 'POST',
      body: {
        hashed_id: user.hashedId,
        auth_provider: user.authProvider,
        display_name: user.displayName || '',
        created_at: user.now,
        last_active_at: user.now,
        settings_json: user.settingsJson || null,
      },
    });
  }
}

// ==========================================
// Activity Log Operations
// ==========================================

export async function logSupabaseActivity(activity: {
  id: string;
  userHashedId: string;
  activityType: string;
  asset: string;
  amount: number;
  txSignature?: string;
  reason?: string;
  createdAt: number;
}) {
  return supabaseFetch('activity_logs', {
    method: 'POST',
    body: {
      id: activity.id,
      user_hashed_id: activity.userHashedId,
      activity_type: activity.activityType,
      asset: activity.asset,
      amount: activity.amount,
      tx_signature: activity.txSignature || '',
      reason: activity.reason || '',
      created_at: activity.createdAt,
    },
  });
}

export async function getSupabaseRecentActivity(userHashedId: string, limit = 50) {
  const { data, error } = await supabaseFetch<any[]>(
    `activity_logs?user_hashed_id=eq.${encodeURIComponent(
      userHashedId
    )}&order=created_at.desc&limit=${limit}`
  );
  return { data: data || [], error };
}

// ==========================================
// Custom Strategies Operations
// ==========================================

export async function getSupabaseCustomStrategies(userHashedId: string) {
  const { data, error } = await supabaseFetch<any[]>(
    `custom_strategies?user_hashed_id=eq.${encodeURIComponent(
      userHashedId
    )}&order=created_at.desc`
  );
  return { data: data || [], error };
}

export async function saveSupabaseCustomStrategy(strategy: {
  id: string;
  userHashedId: string;
  name: string;
  description?: string;
  targetWeightsJson: string;
  createdAt: number;
  updatedAt: number;
}) {
  return supabaseFetch('custom_strategies', {
    method: 'POST',
    body: {
      id: strategy.id,
      user_hashed_id: strategy.userHashedId,
      name: strategy.name,
      description: strategy.description || '',
      target_weights_json: strategy.targetWeightsJson,
      created_at: strategy.createdAt,
      updated_at: strategy.updatedAt,
    },
  });
}
