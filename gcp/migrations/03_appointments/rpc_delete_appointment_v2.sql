CREATE OR REPLACE FUNCTION public.delete_appointment_v2(p_appointment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_apt public.appointments%rowtype;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('delete_appointment_v2'));



  SELECT * INTO v_apt

  FROM public.appointments a

  WHERE a.id = p_appointment_id

    AND a.tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Agendamento n├úo encontrado');

  END IF;



  IF v_apt.status = 'completed' THEN

    PERFORM public.raise_app_error('APPOINTMENT_DELETE_COMPLETED_FORBIDDEN', 'N├úo ├® permitido deletar um agendamento conclu├¡do');

  END IF;



  IF NOT v_is_admin THEN

    IF v_apt.professional_id IS DISTINCT FROM v_profile.id THEN

      PERFORM public.raise_app_error('FORBIDDEN', 'Sem permiss├úo para deletar este agendamento');

    END IF;

    IF v_apt.status <> 'pending' THEN

      PERFORM public.raise_app_error('APPOINTMENT_DELETE_PENDING_ONLY', 'Somente agendamentos pendentes podem ser deletados pelo profissional');

    END IF;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'appointment_deleted',

    'appointment',

    v_apt.id::text,

    jsonb_build_object(

      'reason', NULLIF(p_reason, ''),

      'snapshot', jsonb_build_object(

        'scheduled_at', v_apt.scheduled_at,

        'duration_minutes', v_apt.duration_minutes,

        'status', v_apt.status,

        'professional_id', v_apt.professional_id,

        'client_id', v_apt.client_id,

        'service_id', v_apt.service_id,

        'price', v_apt.price

      )

    )

  );



  DELETE FROM public.appointments

  WHERE id = v_apt.id

    AND tenant_id = v_profile.tenant_id;



  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id);

END;

$function$;