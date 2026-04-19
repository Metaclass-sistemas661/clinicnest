CREATE OR REPLACE FUNCTION public.get_client_timeline_v1(p_client_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(event_at timestamp with time zone, kind text, title text, body text, meta jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_limit integer;

begin

  if v_user_id is null then

    perform public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  end if;



  select * into v_profile

  from public.profiles p

  where p.user_id = v_user_id

  limit 1;



  if not found then

    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  end if;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  -- p_client_id can be either a clients.id or patients.id

  -- Check patients first (primary use case from PacienteDetalhe), then clients

  if not exists (

    select 1 from public.patients pt where pt.id = p_client_id and pt.tenant_id = v_profile.tenant_id

  ) and not exists (

    select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id

  ) then

    perform public.raise_app_error('NOT_FOUND', 'Cliente n├úo encontrado');

  end if;



  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));



  return query

  with apt as (

    select

      a.scheduled_at as event_at,

      'appointment'::text as kind,

      coalesce(pr.name, 'Agendamento') as title,

      coalesce('Status: ' || a.status::text, '') as body,

      jsonb_build_object(

        'appointment_id', a.id,

        'status', a.status,

        'procedure_id', a.procedure_id,

        'professional_id', a.professional_id,

        'price', a.price

      ) as meta

    from public.appointments a

    left join public.procedures pr on pr.id = a.procedure_id

    where a.tenant_id = v_profile.tenant_id

      and a.patient_id = p_client_id

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

      and o.patient_id = p_client_id

  ),

  pay as (

    select

      p.created_at as event_at,

      'payment'::text as kind,

      'Pagamento'::text as title,

      coalesce(pm.name, 'Pagamento') || ' ┬À ' || p.amount::text as body,

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

    where o.patient_id = p_client_id

      and p.status = 'confirmed'

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

$function$;