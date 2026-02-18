-- Milestone 6: Campanhas básicas (email) + opt-out geral

do $$
begin
  create type public.campaign_status as enum ('draft', 'sent', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  subject text not null,
  html text not null,
  status public.campaign_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  to_email text not null,
  status text not null default 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_deliveries_campaign
  on public.campaign_deliveries(campaign_id, created_at desc);

drop trigger if exists update_campaigns_updated_at on public.campaigns;
create trigger update_campaigns_updated_at before update on public.campaigns
for each row execute function public.update_updated_at_column();

alter table public.campaigns enable row level security;
alter table public.campaign_deliveries enable row level security;

create policy "Admins can manage campaigns in their tenant"
  on public.campaigns
  for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id));

create policy "Admins can view campaign deliveries in their tenant"
  on public.campaign_deliveries
  for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id));

revoke all on table public.campaigns from public;
revoke all on table public.campaign_deliveries from public;
