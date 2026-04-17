CREATE OR REPLACE FUNCTION public.create_product_category_v2(p_name text)
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

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode criar categoria');

  END IF;



  IF p_name IS NULL OR btrim(p_name) = '' THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome ├® obrigat├│rio');

  END IF;



  INSERT INTO public.product_categories(tenant_id, name)

  VALUES (v_profile.tenant_id, p_name)

  RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'product_category_created',

    'product_category',

    v_id::text,

    jsonb_build_object('name', p_name)

  );



  RETURN jsonb_build_object('success', true, 'category_id', v_id);

END;

$function$;