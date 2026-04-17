CREATE OR REPLACE FUNCTION public.update_goal_v2(p_goal_id uuid, p_name text, p_target_value numeric, p_period text, p_professional_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_show_in_header boolean DEFAULT NULL::boolean, p_header_priority integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

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



  UPDATE public.goals

  SET name = p_name,

      target_value = p_target_value,

      period = p_period,

      professional_id = p_professional_id,

      product_id = p_product_id,

      show_in_header = COALESCE(p_show_in_header, show_in_header),

      header_priority = COALESCE(p_header_priority, header_priority),

      updated_at = now()

  WHERE id = p_goal_id

    AND tenant_id = v_profile.tenant_id;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Meta n├úo encontrada');

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'goal_updated',

    'goal',

    p_goal_id::text,

    jsonb_build_object('target_value', p_target_value, 'period', p_period)

  );



  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id);

END;

$function$;