CREATE OR REPLACE FUNCTION public.create_goal_v2(p_name text, p_goal_type text, p_target_value numeric, p_period text, p_professional_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_show_in_header boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_id uuid;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');

  END IF;



  IF p_target_value IS NULL OR p_target_value <= 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inv├ílida');

  END IF;



  INSERT INTO public.goals(

    tenant_id,

    name,

    goal_type,

    target_value,

    period,

    professional_id,

    product_id,

    show_in_header

  ) VALUES (

    v_profile.tenant_id,

    COALESCE(NULLIF(btrim(p_name),''), 'Meta'),

    p_goal_type,

    p_target_value,

    p_period,

    p_professional_id,

    p_product_id,

    COALESCE(p_show_in_header,false)

  ) RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'goal_created',

    'goal',

    v_id::text,

    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)

  );



  RETURN jsonb_build_object('success', true, 'goal_id', v_id);

END;

$function$;