CREATE OR REPLACE FUNCTION public.update_product_prices_v2(p_product_id uuid, p_cost numeric, p_sale_price numeric, p_category_id uuid DEFAULT NULL::uuid)
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

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode editar pre├ºos');

  END IF;



  IF p_cost IS NULL OR p_cost < 0 OR p_sale_price IS NULL OR p_sale_price < 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Valores inv├ílidos');

  END IF;



  UPDATE public.products

  SET cost = p_cost,

      sale_price = p_sale_price,

      category_id = p_category_id,

      updated_at = now()

  WHERE id = p_product_id

    AND tenant_id = v_profile.tenant_id;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Produto n├úo encontrado');

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'product_prices_updated',

    'product',

    p_product_id::text,

    jsonb_build_object(

      'cost', p_cost,

      'sale_price', p_sale_price,

      'category_id', p_category_id

    )

  );



  RETURN jsonb_build_object('success', true, 'product_id', p_product_id);

END;

$function$;