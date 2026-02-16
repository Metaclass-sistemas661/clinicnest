alter table public.asaas_webhook_events
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_attempts integer not null default 0,
  add column if not exists alert_last_error text;

create index if not exists asaas_webhook_events_next_retry_at_idx
  on public.asaas_webhook_events(next_retry_at);

create index if not exists asaas_webhook_events_alert_sent_at_idx
  on public.asaas_webhook_events(alert_sent_at);
