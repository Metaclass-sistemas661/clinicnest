-- Milestone 6: Fidelidade (cashback) + preferências de marketing (opt-out geral)

-- 1) Tenant config for cashback
alter table public.tenants
  add column if not exists cashback_enabled boolean not null default false,
  add column if not exists cashback_percent numeric not null default 0;

-- 2) Client marketing preferences (opt-out geral)
create table if not exists public.client_marketing_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  marketing_opt_out boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, client_id)
);

alter table public.client_marketing_preferences enable row level security;

create policy "Users can view marketing preferences in their tenant"
  on public.client_marketing_preferences for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Admins can upsert marketing preferences in their tenant"
  on public.client_marketing_preferences for insert
  to authenticated
  with check (public.is_tenant_admin(auth.uid(), tenant_id));

create policy "Admins can update marketing preferences in their tenant"
  on public.client_marketing_preferences for update
  to authenticated
  using (public.is_tenant_admin(auth.uid(), tenant_id))
  with check (public.is_tenant_admin(auth.uid(), tenant_id));

-- 3) Cashback wallet + ledger
do $$
begin
  create type public.cashback_ledger_reason as enum ('earn', 'redeem', 'adjust', 'revert');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.cashback_wallets (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, client_id)
);

create table if not exists public.cashback_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  delta_amount numeric not null,
  reason public.cashback_ledger_reason not null,
  notes text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_cashback_ledger_client
  on public.cashback_ledger(tenant_id, client_id, created_at desc);

create table if not exists public.appointment_cashback_earnings (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  earned_amount numeric not null,
  earned_at timestamptz not null default now(),
  primary key (tenant_id, appointment_id)
);

alter table public.cashback_wallets enable row level security;
alter table public.cashback_ledger enable row level security;
alter table public.appointment_cashback_earnings enable row level security;

create policy "Users can view cashback wallets in their tenant"
  on public.cashback_wallets for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Users can view cashback ledger in their tenant"
  on public.cashback_ledger for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Users can view appointment cashback earnings in their tenant"
  on public.appointment_cashback_earnings for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

-- 4) RPC: apply cashback on completion (idempotent)
create or replace function public.apply_cashback_for_appointment_v1(
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt public.appointments%rowtype;
  v_tenant public.tenants%rowtype;
  v_amount numeric;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('apply_cashback_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  if v_apt.status <> 'completed' then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'not_completed');
  end if;

  if v_apt.client_id is null then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'missing_client');
  end if;

  if exists (
    select 1 from public.appointment_cashback_earnings e
    where e.tenant_id = v_apt.tenant_id
      and e.appointment_id = v_apt.id
  ) then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'already_applied');
  end if;

  select * into v_tenant
  from public.tenants t
  where t.id = v_apt.tenant_id
  limit 1;

  if v_tenant.cashback_enabled is distinct from true then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'disabled');
  end if;

  if coalesce(v_tenant.cashback_percent, 0) <= 0 then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'percent_zero');
  end if;

  v_amount := round(coalesce(v_apt.price, 0) * (v_tenant.cashback_percent / 100), 2);
  if v_amount <= 0 then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'amount_zero');
  end if;

  insert into public.cashback_wallets(tenant_id, client_id, balance)
  values (v_apt.tenant_id, v_apt.client_id, 0)
  on conflict (tenant_id, client_id) do nothing;

  insert into public.appointment_cashback_earnings(tenant_id, appointment_id, client_id, earned_amount)
  values (v_apt.tenant_id, v_apt.id, v_apt.client_id, v_amount);

  insert into public.cashback_ledger(
    tenant_id, client_id, appointment_id, delta_amount, reason, notes, actor_user_id
  ) values (
    v_apt.tenant_id,
    v_apt.client_id,
    v_apt.id,
    v_amount,
    'earn',
    'Cashback por atendimento concluído',
    v_user_id
  );

  update public.cashback_wallets
    set balance = balance + v_amount,
        updated_at = now()
  where tenant_id = v_apt.tenant_id
    and client_id = v_apt.client_id;

  return jsonb_build_object('success', true, 'applied', true, 'amount', v_amount);
end;
$$;

revoke all on function public.apply_cashback_for_appointment_v1(uuid) from public;
grant execute on function public.apply_cashback_for_appointment_v1(uuid) to authenticated;
grant execute on function public.apply_cashback_for_appointment_v1(uuid) to service_role;
