CREATE OR REPLACE FUNCTION public.get_open_cash_session_summary_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_session_id uuid;

  v_summary jsonb;

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



  SELECT cs.id INTO v_session_id

  FROM public.cash_sessions cs

  WHERE cs.tenant_id = v_profile.tenant_id

    AND cs.status = 'open'

  ORDER BY cs.opened_at DESC

  LIMIT 1;



  IF v_session_id IS NULL THEN

    RETURN jsonb_build_object('success', true, 'has_open_session', false);

  END IF;



  SELECT public.get_cash_session_summary_v1(v_session_id) INTO v_summary;



  RETURN jsonb_build_object(

    'success', true,

    'has_open_session', true,

    'session_id', v_session_id,

    'summary', v_summary,

    'expected_closing_balance', COALESCE((v_summary->>'expected_closing_balance')::numeric, 0)

  );

END;

$function$;