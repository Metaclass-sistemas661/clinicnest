-- Phase 2b: RLS audit fixes (public schema only)

-- 1) asaas_checkout_sessions: enable RLS + restrict to service role
alter table public.asaas_checkout_sessions enable row level security;

do $$
begin
  drop policy if exists "service_role_all" on public.asaas_checkout_sessions;
exception when others then
  null;
end $$;

create policy "service_role_all" on public.asaas_checkout_sessions
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- 2) asaas_webhook_alerts: enable RLS + restrict to service role
alter table public.asaas_webhook_alerts enable row level security;

do $$
begin
  drop policy if exists "service_role_all" on public.asaas_webhook_alerts;
exception when others then
  null;
end $$;

create policy "service_role_all" on public.asaas_webhook_alerts
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- 3) contact_messages: keep public INSERT, but restrict SELECT to service_role only

do $$
begin
  drop policy if exists "Service role can read contact messages" on public.contact_messages;
exception when others then
  null;
end $$;

create policy "Service role can read contact messages" on public.contact_messages
for select
to public
using (auth.role() = 'service_role');

-- 4) subscriptions: remove permissive "allow all" policy (keep scoped policies + RPC paths)

do $$
begin
  drop policy if exists "Allow all for subscriptions" on public.subscriptions;
exception when others then
  null;
end $$;
