CREATE OR REPLACE FUNCTION public.cancel_public_appointment_v1(p_public_booking_token uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_apt public.appointments%rowtype;

  v_tenant public.tenants%rowtype;

  v_min_lead integer;

  v_cutoff timestamptz;

begin

  if p_public_booking_token is null then

    perform public.raise_app_error('VALIDATION_ERROR', 'Token ├® obrigat├│rio');

  end if;



  perform pg_advisory_xact_lock(hashtext(p_public_booking_token::text), hashtext('cancel_public_appointment_v1'));



  select * into v_apt

  from public.appointments a

  where a.public_booking_token = p_public_booking_token

  limit 1

  for update;



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Agendamento n├úo encontrado');

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

    perform public.raise_app_error('APPOINTMENT_DELETE_COMPLETED_FORBIDDEN', 'N├úo ├® permitido cancelar um agendamento conclu├¡do');

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

$function$;