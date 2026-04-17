CREATE OR REPLACE FUNCTION public.create_goal_template_v2(p_name text, p_goal_type text, p_target_value numeric, p_period text)
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

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode salvar template');

  END IF;



  IF p_target_value IS NULL OR p_target_value <= 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inv├ílida');

  END IF;



  INSERT INTO public.goal_templates(tenant_id, name, goal_type, target_value, period)

  VALUES (v_profile.tenant_id, p_name, p_goal_type, p_target_value, p_period)

  RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'goal_template_created',

    'goal_template',

    v_id::text,

    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)

  );



  RETURN jsonb_build_object('success', true, 'template_id', v_id);

END;

$function$;