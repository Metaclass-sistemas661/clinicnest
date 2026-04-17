CREATE OR REPLACE FUNCTION public.set_appointment_status_v2(p_appointment_id uuid, p_status appointment_status)
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



  IF p_status IS NULL THEN

    RAISE EXCEPTION 'status ├® obrigat├│rio';

  END IF;



  IF p_status = 'cancelled' THEN

    -- Reuse existing cancel RPC (idempotent + completed protection)

    RETURN public.cancel_appointment(p_appointment_id, NULL);

  END IF;



  IF p_status = 'completed' THEN

    RAISE EXCEPTION 'Use complete_appointment_with_sale para concluir agendamentos';

  END IF;



  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('set_appointment_status_v2'));



  SELECT * INTO v_apt

  FROM public.appointments a

  WHERE a.id = p_appointment_id

    AND a.tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Agendamento n├úo encontrado';

  END IF;



  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN

    RAISE EXCEPTION 'Sem permiss├úo para alterar status deste agendamento';

  END IF;



  IF v_apt.status = 'completed' THEN

    RAISE EXCEPTION 'N├úo ├® permitido alterar status de agendamento conclu├¡do';

  END IF;



  -- Allowed transitions

  IF p_status = 'confirmed' AND v_apt.status NOT IN ('pending','confirmed') THEN

    RAISE EXCEPTION 'Transi├º├úo de status inv├ílida';

  END IF;



  IF p_status = v_apt.status THEN

    RETURN jsonb_build_object('success', true, 'unchanged', true, 'appointment_id', v_apt.id, 'status', v_apt.status);

  END IF;



  UPDATE public.appointments

  SET status = p_status,

      updated_at = now()

  WHERE id = v_apt.id

    AND tenant_id = v_profile.tenant_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'appointment_status_changed',

    'appointment',

    v_apt.id::text,

    jsonb_build_object('from', v_apt.status, 'to', p_status)

  );



  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'status', p_status);

END;

$function$;