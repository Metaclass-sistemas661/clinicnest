CREATE OR REPLACE FUNCTION public.create_public_appointment_v1(p_tenant_slug text, p_service_id uuid, p_professional_profile_id uuid, p_scheduled_at timestamp with time zone, p_client_name text, p_client_email text DEFAULT NULL::text, p_client_phone text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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

    perform public.raise_app_error('VALIDATION_ERROR', 'Slug do sal├úo ├® obrigat├│rio');

  end if;



  select * into v_tenant

  from public.get_tenant_by_booking_slug_v1(p_tenant_slug);



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Sal├úo n├úo encontrado');

  end if;



  if v_tenant.online_booking_enabled is distinct from true then

    perform public.raise_app_error('BOOKING_DISABLED', 'Agendamento online n├úo est├í dispon├¡vel para este sal├úo');

  end if;



  if p_scheduled_at is null then

    perform public.raise_app_error('VALIDATION_ERROR', 'Data/hora do agendamento ├® obrigat├│ria');

  end if;



  v_min_lead := coalesce(v_tenant.online_booking_min_lead_minutes, 60);

  if p_scheduled_at < now() + make_interval(mins => v_min_lead) then

    perform public.raise_app_error('BOOKING_TOO_SOON', 'Este hor├írio n├úo respeita a anteced├¬ncia m├¡nima');

  end if;



  select * into v_service

  from public.services s

  where s.id = p_service_id

    and s.tenant_id = v_tenant.id

    and s.is_active = true

  limit 1;



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Servi├ºo n├úo encontrado');

  end if;



  select * into v_prof

  from public.profiles p

  where p.id = p_professional_profile_id

    and p.tenant_id = v_tenant.id

  limit 1;



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Profissional n├úo encontrado');

  end if;



  v_duration := greatest(1, coalesce(v_service.duration_minutes, 45));

  v_price := coalesce(v_service.price, 0);

  v_end_at := p_scheduled_at + make_interval(mins => v_duration);



  -- Working hours validation (Milestone 3)

  v_within := public.is_slot_within_working_hours_v1(v_tenant.id, p_professional_profile_id, p_scheduled_at, v_end_at);

  if v_within is distinct from true then

    perform public.raise_app_error('OUTSIDE_WORKING_HOURS', 'Fora do hor├írio de trabalho configurado para este profissional');

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

    perform public.raise_app_error('SCHEDULE_BLOCKED', 'Hor├írio bloqueado na agenda');

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

    perform public.raise_app_error('SLOT_CONFLICT', 'Conflito de hor├írio');

  end if;



  if p_client_name is null or btrim(p_client_name) = '' then

    perform public.raise_app_error('VALIDATION_ERROR', 'Nome do cliente ├® obrigat├│rio');

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

$function$;