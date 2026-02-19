-- Milestone 4: Agendamento online (public booking)

-- 1) Tenant settings
alter table public.tenants
  add column if not exists online_booking_enabled boolean not null default false,
  add column if not exists online_booking_slug text,
  add column if not exists online_booking_min_lead_minutes integer not null default 60,
  add column if not exists online_booking_cancel_min_lead_minutes integer not null default 240;

create unique index if not exists uq_tenants_online_booking_slug
  on public.tenants (lower(online_booking_slug))
  where online_booking_slug is not null;

-- 2) Appointment public booking metadata
alter table public.appointments
  add column if not exists created_via text not null default 'internal',
  add column if not exists public_booking_token uuid default gen_random_uuid(),
  add column if not exists public_booking_client_name text,
  add column if not exists public_booking_client_email text,
  add column if not exists public_booking_client_phone text;

create unique index if not exists uq_appointments_public_booking_token
  on public.appointments(public_booking_token)
  where public_booking_token is not null;

create index if not exists idx_appointments_created_via
  on public.appointments(created_via);

-- 3) Helper: lookup tenant by slug (case-insensitive)
create or replace function public.get_tenant_by_booking_slug_v1(p_slug text)
returns public.tenants
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.tenants t
  where t.online_booking_slug is not null
    and lower(t.online_booking_slug) = lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.get_tenant_by_booking_slug_v1(text) from public;
grant execute on function public.get_tenant_by_booking_slug_v1(text) to service_role;

-- 4) RPC: create public appointment (service_role only)
create or replace function public.create_public_appointment_v1(
  p_tenant_slug text,
  p_service_id uuid,
  p_professional_profile_id uuid,
  p_scheduled_at timestamptz,
  p_client_name text,
  p_client_email text default null,
  p_client_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
  v_service public.services%rowtype;
  v_prof public.profiles%rowtype;
  v_client_id uuid;
  v_duration integer;
  v_price numeric;
  v_end_at timestamptz;
  v_appointment_id uuid;
  v_token uuid;
  v_min_lead integer;
  v_has_conflict boolean;
  v_blocked boolean;
  v_within boolean;
begin
  if p_tenant_slug is null or btrim(p_tenant_slug) = '' then
    perform public.raise_app_error('VALIDATION_ERROR', 'Slug do salão é obrigatório');
  end if;

  select * into v_tenant
  from public.get_tenant_by_booking_slug_v1(p_tenant_slug);

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Salão não encontrado');
  end if;

  if v_tenant.online_booking_enabled is distinct from true then
    perform public.raise_app_error('BOOKING_DISABLED', 'Agendamento online não está disponível para este salão');
  end if;

  if p_scheduled_at is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Data/hora do agendamento é obrigatória');
  end if;

  v_min_lead := coalesce(v_tenant.online_booking_min_lead_minutes, 60);
  if p_scheduled_at < now() + make_interval(mins => v_min_lead) then
    perform public.raise_app_error('BOOKING_TOO_SOON', 'Este horário não respeita a antecedência mínima');
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id
    and s.tenant_id = v_tenant.id
    and s.is_active = true
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  end if;

  select * into v_prof
  from public.profiles p
  where p.id = p_professional_profile_id
    and p.tenant_id = v_tenant.id
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Profissional não encontrado');
  end if;

  v_duration := greatest(1, coalesce(v_service.duration_minutes, 45));
  v_price := coalesce(v_service.price, 0);
  v_end_at := p_scheduled_at + make_interval(mins => v_duration);

  -- Working hours validation (Milestone 3)
  v_within := public.is_slot_within_working_hours_v1(v_tenant.id, p_professional_profile_id, p_scheduled_at, v_end_at);
  if v_within is distinct from true then
    perform public.raise_app_error('OUTSIDE_WORKING_HOURS', 'Fora do horário de trabalho configurado para este profissional');
  end if;

  -- Block validation (Milestone 3)
  select exists(
    select 1
    from public.schedule_blocks b
    where b.tenant_id = v_tenant.id
      and (b.professional_id is null or b.professional_id = p_professional_profile_id)
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) into v_blocked;

  if v_blocked then
    perform public.raise_app_error('SCHEDULE_BLOCKED', 'Horário bloqueado na agenda');
  end if;

  -- Conflict validation
  select exists(
    select 1
    from public.appointments a
    where a.tenant_id = v_tenant.id
      and a.professional_id = p_professional_profile_id
      and a.status <> 'cancelled'
      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
          && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) into v_has_conflict;

  if v_has_conflict then
    perform public.raise_app_error('SLOT_CONFLICT', 'Conflito de horário');
  end if;

  if p_client_name is null or btrim(p_client_name) = '' then
    perform public.raise_app_error('VALIDATION_ERROR', 'Nome do cliente é obrigatório');
  end if;

  -- Create a client record for tenant
  insert into public.clients(tenant_id, name, email, phone, notes)
  values (v_tenant.id, btrim(p_client_name), nullif(btrim(p_client_email), ''), nullif(btrim(p_client_phone), ''), null)
  returning id into v_client_id;

  insert into public.appointments(
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    notes,
    created_via,
    public_booking_client_name,
    public_booking_client_email,
    public_booking_client_phone
  ) values (
    v_tenant.id,
    v_client_id,
    v_service.id,
    v_prof.id,
    p_scheduled_at,
    v_duration,
    'pending',
    v_price,
    nullif(btrim(p_notes), ''),
    'online',
    btrim(p_client_name),
    nullif(btrim(p_client_email), ''),
    nullif(btrim(p_client_phone), '')
  )
  returning id, public_booking_token into v_appointment_id, v_token;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'public_booking_token', v_token,
    'tenant_id', v_tenant.id
  );
end;
$$;

revoke all on function public.create_public_appointment_v1(text, uuid, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.create_public_appointment_v1(text, uuid, uuid, timestamptz, text, text, text, text) to service_role;

-- 5) RPC: cancel public appointment by token (service_role only)
create or replace function public.cancel_public_appointment_v1(
  p_public_booking_token uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apt public.appointments%rowtype;
  v_tenant public.tenants%rowtype;
  v_min_lead integer;
  v_cutoff timestamptz;
begin
  if p_public_booking_token is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Token é obrigatório');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_public_booking_token::text), hashtext('cancel_public_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.public_booking_token = p_public_booking_token
  limit 1
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  select * into v_tenant
  from public.tenants t
  where t.id = v_apt.tenant_id
  limit 1;

  v_min_lead := coalesce(v_tenant.online_booking_cancel_min_lead_minutes, 240);
  v_cutoff := v_apt.scheduled_at - make_interval(mins => v_min_lead);

  if now() > v_cutoff then
    perform public.raise_app_error('BOOKING_CANCEL_TOO_LATE', 'Cancelamento fora do prazo');
  end if;

  if v_apt.status = 'completed' then
    perform public.raise_app_error('APPOINTMENT_DELETE_COMPLETED_FORBIDDEN', 'Não é permitido cancelar um agendamento concluído');
  end if;

  if v_apt.status = 'cancelled' then
    return jsonb_build_object('success', true, 'already_cancelled', true, 'appointment_id', v_apt.id);
  end if;

  update public.appointments
    set status = 'cancelled',
        updated_at = now(),
        notes = case when p_reason is null or btrim(p_reason) = '' then notes else coalesce(notes, '') || '\nCancelamento (online): ' || p_reason end
  where id = v_apt.id;

  return jsonb_build_object('success', true, 'already_cancelled', false, 'appointment_id', v_apt.id);
end;
$$;

revoke all on function public.cancel_public_appointment_v1(uuid, text) from public;
grant execute on function public.cancel_public_appointment_v1(uuid, text) to service_role;
