-- Asaas webhook event log + idempotency

create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  attempts integer not null default 0,
  last_error text,
  payload jsonb
);

create index if not exists asaas_webhook_events_received_at_idx
  on public.asaas_webhook_events(received_at desc);

create index if not exists asaas_webhook_events_status_idx
  on public.asaas_webhook_events(status);

alter table public.asaas_webhook_events enable row level security;

create policy "service_role_all" on public.asaas_webhook_events
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Add Asaas identifiers to subscriptions
alter table public.subscriptions
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists billing_provider text;

create index if not exists idx_subscriptions_asaas_customer_id
  on public.subscriptions(asaas_customer_id);

create index if not exists idx_subscriptions_asaas_subscription_id
  on public.subscriptions(asaas_subscription_id);
