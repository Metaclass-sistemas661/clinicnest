CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_apt public.appointments%rowtype;

  v_is_admin boolean;

  v_already_cancelled boolean := false;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado';

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('cancel_appointment'));



  SELECT * INTO v_apt

  FROM public.appointments a

  WHERE a.id = p_appointment_id

    AND a.tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Agendamento n├úo encontrado';

  END IF;



  IF v_apt.status = 'completed' THEN

    RAISE EXCEPTION 'N├úo ├® permitido cancelar um agendamento conclu├¡do';

  END IF;



  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN

    RAISE EXCEPTION 'Sem permiss├úo para cancelar este agendamento';

  END IF;



  IF v_apt.status = 'cancelled' THEN

    v_already_cancelled := true;

  ELSE

    UPDATE public.appointments

      SET status = 'cancelled',

          updated_at = now(),

          notes = CASE

            WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN notes

            ELSE COALESCE(notes, '') || '\nCancelamento: ' || p_reason

          END

    WHERE id = v_apt.id

      AND tenant_id = v_profile.tenant_id;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'appointment_cancelled',

    'appointment',

    v_apt.id::text,

    jsonb_build_object(

      'already_cancelled', v_already_cancelled,

      'reason', NULLIF(p_reason, ''),

      'was_admin', v_is_admin

    )

  );



  RETURN jsonb_build_object('success', true, 'already_cancelled', v_already_cancelled, 'appointment_id', v_apt.id);

END;

$function$;