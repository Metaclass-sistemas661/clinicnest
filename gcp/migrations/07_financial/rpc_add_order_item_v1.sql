CREATE OR REPLACE FUNCTION public.add_order_item_v1(p_order_id uuid, p_kind text, p_service_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_quantity integer DEFAULT 1, p_unit_price numeric DEFAULT NULL::numeric, p_professional_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id     uuid := current_setting('app.current_user_id')::uuid;

  v_profile     public.profiles%rowtype;

  v_order       public.orders%rowtype;

  v_price       numeric;

  v_total       numeric;

  v_item_id     uuid;

  v_new_subtotal numeric;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;



  SELECT * INTO v_order FROM public.orders

  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda n├úo encontrada' USING DETAIL = 'NOT_FOUND'; END IF;



  IF v_order.status NOT IN ('draft', 'open') THEN

    RAISE EXCEPTION 'Comanda n├úo permite altera├º├Áes (status: %)', v_order.status USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_kind NOT IN ('service', 'product') THEN

    RAISE EXCEPTION 'Tipo de item inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_quantity IS NULL OR p_quantity <= 0 THEN

    RAISE EXCEPTION 'Quantidade inv├ílida' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  -- Resolve price

  IF p_kind = 'service' THEN

    IF p_service_id IS NULL THEN

      RAISE EXCEPTION 'service_id obrigat├│rio para item tipo servi├ºo' USING DETAIL = 'VALIDATION_ERROR';

    END IF;

    IF p_unit_price IS NOT NULL THEN

      v_price := p_unit_price;

    ELSE

      SELECT price INTO v_price FROM public.services WHERE id = p_service_id AND tenant_id = v_profile.tenant_id;

      IF NOT FOUND THEN RAISE EXCEPTION 'Servi├ºo n├úo encontrado' USING DETAIL = 'NOT_FOUND'; END IF;

    END IF;

  ELSE -- product

    IF p_product_id IS NULL THEN

      RAISE EXCEPTION 'product_id obrigat├│rio para item tipo produto' USING DETAIL = 'VALIDATION_ERROR';

    END IF;

    IF p_unit_price IS NOT NULL THEN

      v_price := p_unit_price;

    ELSE

      SELECT sale_price INTO v_price FROM public.products WHERE id = p_product_id AND tenant_id = v_profile.tenant_id;

      IF NOT FOUND THEN RAISE EXCEPTION 'Produto n├úo encontrado' USING DETAIL = 'NOT_FOUND'; END IF;

    END IF;

  END IF;



  v_total := v_price * p_quantity;



  INSERT INTO public.order_items (

    tenant_id, order_id, kind, service_id, product_id, professional_id,

    quantity, unit_price, total_price

  ) VALUES (

    v_profile.tenant_id, p_order_id, p_kind::public.order_item_kind,

    p_service_id, p_product_id, p_professional_id,

    p_quantity, v_price, v_total

  )

  RETURNING id INTO v_item_id;



  -- Recalculate subtotal

  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal

  FROM public.order_items WHERE order_id = p_order_id;



  UPDATE public.orders

  SET subtotal_amount = v_new_subtotal,

      total_amount = GREATEST(v_new_subtotal - discount_amount, 0),

      updated_at = now()

  WHERE id = p_order_id;



  RETURN jsonb_build_object('success', true, 'item_id', v_item_id, 'subtotal', v_new_subtotal);

END;

$function$;