CREATE OR REPLACE FUNCTION public.upsert_service_v2(p_name text, p_duration_minutes integer, p_price numeric, p_description text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_id uuid;

  v_action text;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar servi├ºos');

  END IF;



  IF p_name IS NULL OR btrim(p_name) = '' THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome ├® obrigat├│rio');

  END IF;



  IF p_duration_minutes IS NULL OR p_duration_minutes < 5 OR p_duration_minutes > 480 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Dura├º├úo inv├ílida');

  END IF;



  IF p_price IS NULL OR p_price < 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Pre├ºo inv├ílido');

  END IF;



  IF p_service_id IS NULL THEN

    v_action := 'service_created';

    INSERT INTO public.services(tenant_id, name, description, duration_minutes, price, is_active)

    VALUES (v_profile.tenant_id, p_name, NULLIF(p_description,''), p_duration_minutes, p_price, COALESCE(p_is_active,true))

    RETURNING id INTO v_id;

  ELSE

    v_action := 'service_updated';

    UPDATE public.services

    SET name = p_name,

        description = NULLIF(p_description,''),

        duration_minutes = p_duration_minutes,

        price = p_price,

        is_active = COALESCE(p_is_active, is_active),

        updated_at = now()

    WHERE id = p_service_id

      AND tenant_id = v_profile.tenant_id

    RETURNING id INTO v_id;



    IF NOT FOUND THEN

      PERFORM public.raise_app_error('NOT_FOUND', 'Servi├ºo n├úo encontrado');

    END IF;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    v_action,

    'service',

    v_id::text,

    jsonb_build_object(

      'name', p_name,

      'duration_minutes', p_duration_minutes,

      'price', p_price,

      'is_active', COALESCE(p_is_active,true)

    )

  );



  RETURN jsonb_build_object('success', true, 'service_id', v_id);

END;

$function$;