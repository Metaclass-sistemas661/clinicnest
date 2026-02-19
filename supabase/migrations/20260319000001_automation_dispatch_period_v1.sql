-- Hotfix: adds dispatch_period to automation_dispatch_logs for installs where
-- 20260319000000 was applied before this column was added.
-- Safe no-op if the table was created with dispatch_period already (fresh installs).

ALTER TABLE public.automation_dispatch_logs
  ADD COLUMN IF NOT EXISTS dispatch_period TEXT NOT NULL DEFAULT 'once';

-- Drop old unique index (column set no longer sufficient for recurring triggers)
DROP INDEX IF EXISTS public.uq_automation_dispatch_once;

-- Ensure the new index exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_dispatch_v2
  ON public.automation_dispatch_logs(automation_id, entity_type, entity_id, dispatch_period);
