-- Cron job to trigger automation-worker every 5 minutes.
-- Requires: pg_cron and pg_net extensions enabled in Supabase Dashboard
--           (Database → Extensions → pg_cron and pg_net).
--
-- Before applying, set these database settings once (run as superuser):
--   ALTER DATABASE postgres SET "app.supabase_project_url" = 'https://YOUR_PROJECT_REF.supabase.co';
--   ALTER DATABASE postgres SET "app.automation_worker_key" = 'YOUR_AUTOMATION_WORKER_KEY';
--
-- The AUTOMATION_WORKER_KEY must match the same secret set in
-- Supabase Edge Function secrets for the automation-worker function.

-- Enable required extensions (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function that calls the automation-worker edge function
-- Uses public schema (internal schema does not exist by default in Supabase)
CREATE OR REPLACE FUNCTION public.call_automation_worker_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_url text;
  v_worker_key  text;
BEGIN
  v_project_url := current_setting('app.supabase_project_url', true);
  v_worker_key  := current_setting('app.automation_worker_key', true);

  IF v_project_url IS NULL OR v_project_url = '' OR
     v_worker_key IS NULL OR v_worker_key = '' THEN
    RAISE WARNING '[automation-worker] app.supabase_project_url ou app.automation_worker_key não configurado. Consulte o comentário desta migration.';
    RETURN;
  END IF;

  -- Fire and forget via pg_net (async HTTP POST)
  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/automation-worker?since_minutes=10',
    headers := jsonb_build_object(
      'Content-Type',            'application/json',
      'x-automation-worker-key', v_worker_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

-- Restrict to service_role only (not accessible to regular users)
REVOKE ALL ON FUNCTION public.call_automation_worker_cron() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_automation_worker_cron() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.call_automation_worker_cron() TO service_role;

-- Remove existing job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-worker-every-5min') THEN
    PERFORM cron.unschedule('automation-worker-every-5min');
  END IF;
END;
$$;

-- Schedule: every 5 minutes
SELECT cron.schedule(
  'automation-worker-every-5min',
  '*/5 * * * *',
  'SELECT public.call_automation_worker_cron()'
);
