CREATE OR REPLACE FUNCTION public.open_cash_session_v1(p_opening_balance numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id   uuid := current_setting('app.current_user_id')::uuid;

  v_profile   public.profiles%rowtype;

  v_session_id uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  IF p_opening_balance < 0 THEN

    RAISE EXCEPTION 'Saldo inicial inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF EXISTS (

    SELECT 1 FROM public.cash_sessions

    WHERE tenant_id = v_profile.tenant_id AND status = 'open'

  ) THEN

    RAISE EXCEPTION 'J├í existe um caixa aberto' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  INSERT INTO public.cash_sessions (

    tenant_id, status,

    opened_at, opened_by,

    opening_balance, opening_notes

  ) VALUES (

    v_profile.tenant_id, 'open',

    now(), v_user_id,

    COALESCE(p_opening_balance, 0), p_notes

  )

  RETURNING id INTO v_session_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'cash_session_opened',

    'cash_session',

    v_session_id::text,

    jsonb_build_object('opening_balance', COALESCE(p_opening_balance, 0))

  );



  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);

END;

$function$;