CREATE OR REPLACE FUNCTION public.set_service_active_v2(p_service_id uuid, p_is_active boolean)
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

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode alterar status do servi├ºo');

  END IF;



  UPDATE public.services

  SET is_active = p_is_active,

      updated_at = now()

  WHERE id = p_service_id

    AND tenant_id = v_profile.tenant_id

  RETURNING id INTO v_id;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Servi├ºo n├úo encontrado');

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'service_active_changed',

    'service',

    v_id::text,

    jsonb_build_object('is_active', p_is_active)

  );



  RETURN jsonb_build_object('success', true, 'service_id', v_id, 'is_active', p_is_active);

END;

$function$;