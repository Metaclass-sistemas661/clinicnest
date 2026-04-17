CREATE OR REPLACE FUNCTION public.upsert_professional_working_hours_v1(p_professional_id uuid, p_day_of_week smallint, p_start_time time without time zone, p_end_time time without time zone, p_is_active boolean DEFAULT true)
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



  -- Staff can only edit own schedule

  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN

    RAISE EXCEPTION 'Sem permiss├úo para editar disponibilidade de outro profissional' USING DETAIL = 'FORBIDDEN';

  END IF;



  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN

    RAISE EXCEPTION 'Dia da semana inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_end_time <= p_start_time THEN

    RAISE EXCEPTION 'Intervalo de hor├írio inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF NOT EXISTS (

    SELECT 1 FROM public.profiles p

    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id

  ) THEN

    RAISE EXCEPTION 'Profissional inv├ílido para o tenant' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  INSERT INTO public.professional_working_hours (

    tenant_id, professional_id, day_of_week, start_time, end_time, is_active

  ) VALUES (

    v_profile.tenant_id, p_professional_id, p_day_of_week, p_start_time, p_end_time, COALESCE(p_is_active, true)

  )

  ON CONFLICT (tenant_id, professional_id, day_of_week)

  DO UPDATE SET

    start_time = EXCLUDED.start_time,

    end_time = EXCLUDED.end_time,

    is_active = EXCLUDED.is_active,

    updated_at = now()

  RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'professional_working_hours_upserted',

    'professional_working_hours',

    v_id::text,

    jsonb_build_object(

      'professional_id', p_professional_id,

      'day_of_week', p_day_of_week,

      'start_time', p_start_time,

      'end_time', p_end_time,

      'is_active', COALESCE(p_is_active, true)

    )

  );



  RETURN jsonb_build_object('success', true, 'id', v_id);

END;

$function$;