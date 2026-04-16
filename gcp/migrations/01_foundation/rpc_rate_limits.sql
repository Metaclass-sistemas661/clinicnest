-- Table: rpc_rate_limits
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id UUID NOT NULL,
  rpc_name TEXT NOT NULL,
  window_start TIMESTAMPTZ DEFAULT date_trunc('minute'::text, now()) NOT NULL,
  call_count INTEGER DEFAULT 1 NOT NULL,
  PRIMARY KEY (user_id, rpc_name, window_start)
);
