-- Stripe webhook event log + idempotency

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  type text not null,
  livemode boolean not null default false,
  api_version text,
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  attempts integer not null default 0,
  last_error text,
  payload jsonb
);

create index if not exists stripe_webhook_events_type_idx on public.stripe_webhook_events(type);
create index if not exists stripe_webhook_events_status_idx on public.stripe_webhook_events(status);
create index if not exists stripe_webhook_events_received_at_idx on public.stripe_webhook_events(received_at desc);

alter table public.stripe_webhook_events enable row level security;

-- Only allow server-side (service role) to access webhook event logs.
create policy "service_role_all" on public.stripe_webhook_events
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
