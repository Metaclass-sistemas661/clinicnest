-- Milestone 5: CRM (timeline) + pacotes (sessões) com saldo consistente

-- 1) Pacotes por sessões

do $$
begin
  create type public.client_package_status as enum ('active', 'depleted', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.client_package_ledger_reason as enum ('purchase', 'consume', 'adjust', 'revert', 'cancel');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  total_sessions integer not null check (total_sessions > 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  status public.client_package_status not null default 'active',
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_packages_tenant_client
  on public.client_packages(tenant_id, client_id);
create index if not exists idx_client_packages_tenant_service
  on public.client_packages(tenant_id, service_id);
create index if not exists idx_client_packages_active_lookup
  on public.client_packages(tenant_id, client_id, service_id, status, remaining_sessions);

create table if not exists public.client_package_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  package_id uuid not null references public.client_packages(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  delta_sessions integer not null,
  reason public.client_package_ledger_reason not null,
  notes text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_package_ledger_pkg
  on public.client_package_ledger(package_id, created_at desc);

create table if not exists public.appointment_package_consumptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  package_id uuid not null references public.client_packages(id) on delete cascade,
  consumed_at timestamptz not null default now(),
  unique(appointment_id)
);

create index if not exists idx_appointment_package_consumptions_pkg
  on public.appointment_package_consumptions(package_id);

-- updated_at trigger
drop trigger if exists update_client_packages_updated_at on public.client_packages;
create trigger update_client_packages_updated_at before update on public.client_packages
for each row execute function public.update_updated_at_column();

alter table public.client_packages enable row level security;
alter table public.client_package_ledger enable row level security;
alter table public.appointment_package_consumptions enable row level security;

-- RLS: tenant-scoped for authenticated
create policy "Users can view client packages in their tenant"
on public.client_packages for select
to authenticated
using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Users can view client package ledger in their tenant"
on public.client_package_ledger for select
to authenticated
using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Users can view appointment package consumptions in their tenant"
on public.appointment_package_consumptions for select
to authenticated
using (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Inserts/updates via RPC only (admin)
revoke all on table public.client_packages from public;
revoke all on table public.client_package_ledger from public;
revoke all on table public.appointment_package_consumptions from public;

-- 2) RPCs

create or replace function public.create_client_package_v1(
  p_client_id uuid,
  p_service_id uuid,
  p_total_sessions integer,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_pkg_id uuid;
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

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem criar pacotes');
  end if;

  if p_total_sessions is null or p_total_sessions <= 0 then
    perform public.raise_app_error('VALIDATION_ERROR', 'Quantidade de sessões inválida');
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id) then
    perform public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
  end if;

  if not exists (select 1 from public.services s where s.id = p_service_id and s.tenant_id = v_profile.tenant_id and s.is_active = true) then
    perform public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  end if;

  insert into public.client_packages(
    tenant_id, client_id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, notes, created_by
  ) values (
    v_profile.tenant_id, p_client_id, p_service_id, p_total_sessions, p_total_sessions, 'active', now(), p_expires_at, nullif(btrim(p_notes), ''), v_user_id
  ) returning id into v_pkg_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id, v_pkg_id, null, p_total_sessions, 'purchase', 'Compra de pacote', v_user_id
  );

  return jsonb_build_object('success', true, 'package_id', v_pkg_id);
end;
$$;

revoke all on function public.create_client_package_v1(uuid, uuid, integer, timestamptz, text) from public;
grant execute on function public.create_client_package_v1(uuid, uuid, integer, timestamptz, text) to authenticated;
grant execute on function public.create_client_package_v1(uuid, uuid, integer, timestamptz, text) to service_role;

create or replace function public.consume_package_session_for_appointment_v1(
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
  v_is_admin boolean := false;
  v_apt public.appointments%rowtype;
  v_pkg public.client_packages%rowtype;
  v_consumption_id uuid;
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

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('consume_package_session_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  if not v_is_admin and v_apt.professional_id is distinct from v_profile.id then
    perform public.raise_app_error('FORBIDDEN', 'Sem permissão');
  end if;

  if v_apt.status <> 'completed' then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'not_completed');
  end if;

  -- idempotency
  if exists (select 1 from public.appointment_package_consumptions c where c.appointment_id = v_apt.id) then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'already_consumed');
  end if;

  if v_apt.client_id is null or v_apt.service_id is null then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'missing_client_or_service');
  end if;

  -- pick package
  select * into v_pkg
  from public.client_packages p
  where p.tenant_id = v_profile.tenant_id
    and p.client_id = v_apt.client_id
    and p.service_id = v_apt.service_id
    and p.status = 'active'
    and p.remaining_sessions > 0
    and (p.expires_at is null or p.expires_at > now())
  order by p.expires_at nulls last, p.purchased_at asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'no_package');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pkg.id::text), hashtext('consume_client_package'));

  insert into public.appointment_package_consumptions(tenant_id, appointment_id, package_id)
  values (v_profile.tenant_id, v_apt.id, v_pkg.id)
  returning id into v_consumption_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id, v_pkg.id, v_apt.id, -1, 'consume', 'Consumo automático ao concluir atendimento', v_user_id
  );

  update public.client_packages
    set remaining_sessions = remaining_sessions - 1,
        status = case when remaining_sessions - 1 <= 0 then 'depleted' else status end,
        updated_at = now()
  where id = v_pkg.id
    and tenant_id = v_profile.tenant_id
    and remaining_sessions > 0;

  return jsonb_build_object('success', true, 'consumed', true, 'package_id', v_pkg.id);
end;
$$;

revoke all on function public.consume_package_session_for_appointment_v1(uuid) from public;
grant execute on function public.consume_package_session_for_appointment_v1(uuid) to authenticated;
grant execute on function public.consume_package_session_for_appointment_v1(uuid) to service_role;

-- 3) Timeline (MVP): appointments + orders/payments
create or replace function public.get_client_timeline_v1(
  p_client_id uuid,
  p_limit integer default 50
)
returns table(
  event_at timestamptz,
  kind text,
  title text,
  body text,
  meta jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_limit integer;
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

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id) then
    perform public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));

  return query
  with apt as (
    select
      a.scheduled_at as event_at,
      'appointment'::text as kind,
      coalesce(s.name, 'Agendamento') as title,
      coalesce('Status: ' || a.status::text, '') as body,
      jsonb_build_object(
        'appointment_id', a.id,
        'status', a.status,
        'service_id', a.service_id,
        'professional_id', a.professional_id,
        'price', a.price
      ) as meta
    from public.appointments a
    left join public.services s on s.id = a.service_id
    where a.tenant_id = v_profile.tenant_id
      and a.client_id = p_client_id
  ),
  ord as (
    select
      o.created_at as event_at,
      'order'::text as kind,
      'Comanda'::text as title,
      coalesce('Status: ' || o.status::text, '') as body,
      jsonb_build_object(
        'order_id', o.id,
        'appointment_id', o.appointment_id,
        'total_amount', o.total_amount,
        'status', o.status
      ) as meta
    from public.orders o
    where o.tenant_id = v_profile.tenant_id
      and o.client_id = p_client_id
  ),
  pay as (
    select
      p.paid_at as event_at,
      'payment'::text as kind,
      'Pagamento'::text as title,
      coalesce(pm.name, 'Pagamento') || ' · ' || p.amount::text as body,
      jsonb_build_object(
        'payment_id', p.id,
        'order_id', p.order_id,
        'amount', p.amount,
        'status', p.status,
        'payment_method', pm.name
      ) as meta
    from public.payments p
    left join public.payment_methods pm on pm.id = p.payment_method_id
    join public.orders o on o.id = p.order_id and o.tenant_id = v_profile.tenant_id
    where o.client_id = p_client_id
      and p.status = 'paid'
      and p.paid_at is not null
  )
  select * from (
    select * from apt
    union all
    select * from ord
    union all
    select * from pay
  ) x
  order by event_at desc nulls last
  limit v_limit;
end;
$$;

revoke all on function public.get_client_timeline_v1(uuid, integer) from public;
grant execute on function public.get_client_timeline_v1(uuid, integer) to authenticated;
grant execute on function public.get_client_timeline_v1(uuid, integer) to service_role;
