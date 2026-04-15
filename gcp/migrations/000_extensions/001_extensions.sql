-- ============================================================
-- GCP Cloud SQL Migration - 001_extensions.sql
-- Execution Order: 001
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: Extensions
-- Extracted from Supabase migrations

-- Source: 20260319000002_automation_cron_v1.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Source: 20260319000002_automation_cron_v1.sql
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Source: 20260326000001_fix_pgcrypto_search_path.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto -- WITH SCHEMA extensions  -- GCP: using default schema;

