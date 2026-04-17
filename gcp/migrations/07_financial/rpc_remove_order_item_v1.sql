CREATE OR REPLACE FUNCTION public.remove_order_item_v1(p_order_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id      uuid := current_setting('app.current_user_id')::uuid;

  v_profile      public.profiles%rowtype;

  v_item         public.order_items%rowtype;

  v_order        public.orders%rowtype;

  v_new_subtotal numeric;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;



  SELECT * INTO v_item FROM public.order_items

  WHERE id = p_order_item_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item n├úo encontrado' USING DETAIL = 'NOT_FOUND'; END IF;



  SELECT * INTO v_order FROM public.orders

  WHERE id = v_item.order_id AND tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF v_order.status NOT IN ('draft', 'open') THEN

    RAISE EXCEPTION 'Comanda n├úo permite altera├º├Áes' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  DELETE FROM public.order_items WHERE id = p_order_item_id;



  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal

  FROM public.order_items WHERE order_id = v_order.id;



  UPDATE public.orders

  SET subtotal_amount = v_new_subtotal,

      discount_amount = LEAST(discount_amount, v_new_subtotal),

      total_amount = GREATEST(v_new_subtotal - LEAST(discount_amount, v_new_subtotal), 0),

      updated_at = now()

  WHERE id = v_order.id;



  RETURN jsonb_build_object('success', true, 'subtotal', v_new_subtotal);

END;

$function$;