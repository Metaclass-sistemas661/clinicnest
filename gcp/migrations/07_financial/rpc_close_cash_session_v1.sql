CREATE OR REPLACE FUNCTION public.close_cash_session_v1(p_session_id uuid, p_reported_balance numeric, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_session public.cash_sessions%rowtype;

  v_summary jsonb;

  v_expected numeric;

  v_diff numeric;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  SELECT * INTO v_session

  FROM public.cash_sessions

  WHERE id = p_session_id AND tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Caixa n├úo encontrado' USING DETAIL = 'NOT_FOUND';

  END IF;



  IF v_session.status <> 'open' THEN

    RAISE EXCEPTION 'Caixa j├í est├í fechado' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_reported_balance IS NULL OR p_reported_balance < 0 THEN

    RAISE EXCEPTION 'Saldo informado inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  -- Close window first for consistent summary

  UPDATE public.cash_sessions

  SET closed_at = now(), closed_by = v_user_id, updated_at = now()

  WHERE id = v_session.id;



  -- Recalculate session after setting closed_at

  SELECT public.get_cash_session_summary_v1(v_session.id) INTO v_summary;

  v_expected := COALESCE((v_summary->>'expected_closing_balance')::numeric, 0);

  v_diff := p_reported_balance - v_expected;



  UPDATE public.cash_sessions

  SET status = 'closed',

      closing_balance_reported = p_reported_balance,

      closing_balance_expected = v_expected,

      closing_difference = v_diff,

      closing_notes = p_notes,

      updated_at = now()

  WHERE id = v_session.id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'cash_session_closed',

    'cash_session',

    v_session.id::text,

    jsonb_build_object(

      'expected', v_expected,

      'reported', p_reported_balance,

      'difference', v_diff

    )

  );



  RETURN jsonb_build_object(

    'success', true,

    'session_id', v_session.id,

    'status', 'closed',

    'expected', v_expected,

    'reported', p_reported_balance,

    'difference', v_diff

  );

END;

$function$;