-- GCP Migration: Extensions
-- Extracted from Supabase migrations

-- Source: 20260319000002_automation_cron_v1.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Source: 20260319000002_automation_cron_v1.sql
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Source: 20260326000001_fix_pgcrypto_search_path.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

