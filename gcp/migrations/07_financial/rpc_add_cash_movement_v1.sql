CREATE OR REPLACE FUNCTION public.add_cash_movement_v1(p_type text, p_amount numeric, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_session public.cash_sessions%rowtype;

  v_movement_id uuid;

  v_type public.cash_movement_type;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  IF p_amount IS NULL OR p_amount <= 0 THEN

    RAISE EXCEPTION 'Valor inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_type NOT IN ('reinforcement','withdrawal') THEN

    RAISE EXCEPTION 'Tipo de movimenta├º├úo inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  v_type := p_type::public.cash_movement_type;



  SELECT * INTO v_session

  FROM public.cash_sessions

  WHERE tenant_id = v_profile.tenant_id AND status = 'open'

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'N├úo h├í caixa aberto' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  INSERT INTO public.cash_movements (

    tenant_id, session_id, type, amount, reason, created_by

  ) VALUES (

    v_profile.tenant_id, v_session.id, v_type, p_amount, p_reason, v_user_id

  )

  RETURNING id INTO v_movement_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'cash_movement_created',

    'cash_movement',

    v_movement_id::text,

    jsonb_build_object('session_id', v_session.id, 'type', p_type, 'amount', p_amount)

  );



  RETURN jsonb_build_object('success', true, 'movement_id', v_movement_id, 'session_id', v_session.id);

END;

$function$;