-- ==========================================================
-- StockPilot Supabase Schema Migration
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  hashed_id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL DEFAULT 'solana_wallet',
  display_name TEXT,
  created_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL,
  settings_json TEXT
);

-- 2. Activity Logs Table (Deposits, Rebalances, Swaps)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  user_hashed_id TEXT NOT NULL REFERENCES public.users(hashed_id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT 'USDC',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  tx_signature TEXT,
  reason TEXT,
  created_at BIGINT NOT NULL
);

-- 3. Custom Strategies Table
CREATE TABLE IF NOT EXISTS public.custom_strategies (
  id TEXT PRIMARY KEY,
  user_hashed_id TEXT NOT NULL REFERENCES public.users(hashed_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_weights_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 4. Portfolio Snapshots Table
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id TEXT PRIMARY KEY,
  user_hashed_id TEXT NOT NULL REFERENCES public.users(hashed_id) ON DELETE CASCADE,
  total_value_usdc DOUBLE PRECISION NOT NULL DEFAULT 0,
  holdings_json TEXT,
  snapshot_at BIGINT NOT NULL
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_logs(user_hashed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON public.custom_strategies(user_hashed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON public.portfolio_snapshots(user_hashed_id, snapshot_at DESC);

-- Enable Row Level Security (RLS) but allow service-role / anon full API access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies allowing backend API routes with anon / service role to read and write
CREATE POLICY "Allow public backend access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public backend access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public backend access to custom_strategies" ON public.custom_strategies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public backend access to portfolio_snapshots" ON public.portfolio_snapshots FOR ALL USING (true) WITH CHECK (true);
