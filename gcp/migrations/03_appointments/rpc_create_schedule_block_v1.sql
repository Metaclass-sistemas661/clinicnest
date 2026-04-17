CREATE OR REPLACE FUNCTION public.create_schedule_block_v1(p_professional_id uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_id uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  -- Staff can only create blocks for themselves

  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN

    RAISE EXCEPTION 'Sem permiss├úo para criar bloqueio para outro profissional' USING DETAIL = 'FORBIDDEN';

  END IF;



  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN

    RAISE EXCEPTION 'Per├¡odo inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_professional_id IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles p

    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id

  ) THEN

    RAISE EXCEPTION 'Profissional inv├ílido para o tenant' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  INSERT INTO public.schedule_blocks (

    tenant_id, professional_id, start_at, end_at, reason, created_by

  ) VALUES (

    v_profile.tenant_id, p_professional_id, p_start_at, p_end_at, NULLIF(p_reason, ''), v_user_id

  )

  RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'schedule_block_created',

    'schedule_block',

    v_id::text,

    jsonb_build_object(

      'professional_id', p_professional_id,

      'start_at', p_start_at,

      'end_at', p_end_at,

      'reason', p_reason

    )

  );



  RETURN jsonb_build_object('success', true, 'block_id', v_id);

END;

$function$;