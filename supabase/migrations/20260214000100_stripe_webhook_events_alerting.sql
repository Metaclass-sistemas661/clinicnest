alter table public.stripe_webhook_events
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_attempts integer not null default 0,
  add column if not exists alert_last_error text;

create index if not exists stripe_webhook_events_failed_unalerted_idx
  on public.stripe_webhook_events (received_at)
  where status = 'failed' and alert_sent_at is null;
