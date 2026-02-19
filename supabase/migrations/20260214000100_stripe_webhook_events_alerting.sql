DO $$
BEGIN
  IF to_regclass('public.stripe_webhook_events') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.stripe_webhook_events
    ADD COLUMN IF NOT EXISTS alert_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS alert_attempts integer not null default 0,
    ADD COLUMN IF NOT EXISTS alert_last_error text;

  CREATE INDEX IF NOT EXISTS stripe_webhook_events_failed_unalerted_idx
    ON public.stripe_webhook_events (received_at)
    WHERE status = 'failed' AND alert_sent_at IS NULL;
END $$;
