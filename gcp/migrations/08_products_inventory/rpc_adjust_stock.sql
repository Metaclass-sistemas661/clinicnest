CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_movement_type text, p_quantity integer, p_out_reason_type text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_purchased_with_company_cash boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_product public.products%rowtype;

  v_signed_qty integer;

  v_new_qty integer;

  v_amount numeric;

  v_tx_id uuid;

  v_movement_id uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF p_quantity IS NULL OR p_quantity <= 0 THEN

    RAISE EXCEPTION 'Quantidade inv├ílida';

  END IF;



  IF p_movement_type NOT IN ('in', 'out') THEN

    RAISE EXCEPTION 'movement_type inv├ílido';

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado';

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    RAISE EXCEPTION 'Apenas admin pode ajustar estoque';

  END IF;



  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text), hashtext('adjust_stock'));



  SELECT * INTO v_product

  FROM public.products pr

  WHERE pr.id = p_product_id

    AND pr.tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Produto n├úo encontrado';

  END IF;



  v_signed_qty := CASE WHEN p_movement_type = 'in' THEN p_quantity ELSE -p_quantity END;

  v_new_qty := v_product.quantity + v_signed_qty;



  IF v_new_qty < 0 THEN

    RAISE EXCEPTION 'Estoque insuficiente';

  END IF;



  INSERT INTO public.stock_movements (

    tenant_id,

    product_id,

    quantity,

    movement_type,

    out_reason_type,

    reason,

    created_by

  ) VALUES (

    v_profile.tenant_id,

    v_product.id,

    v_signed_qty,

    p_movement_type,

    CASE WHEN p_movement_type = 'out' THEN NULLIF(p_out_reason_type, '') ELSE NULL END,

    p_reason,

    v_profile.id

  ) RETURNING id INTO v_movement_id;



  UPDATE public.products

    SET quantity = v_new_qty,

        updated_at = now()

  WHERE id = v_product.id

    AND tenant_id = v_profile.tenant_id;



  IF p_movement_type = 'in' AND p_purchased_with_company_cash IS TRUE THEN

    v_amount := COALESCE(v_product.cost, 0) * p_quantity;

    INSERT INTO public.financial_transactions (

      tenant_id,

      type,

      category,

      amount,

      description,

      transaction_date,

      product_id

    ) VALUES (

      v_profile.tenant_id,

      'expense',

      'Produtos',

      v_amount,

      'Compra de produto (entrada de estoque) - ' || COALESCE(v_product.name, 'Produto'),

      current_date,

      v_product.id

    ) RETURNING id INTO v_tx_id;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'stock_adjusted',

    'product',

    v_product.id::text,

    jsonb_build_object(

      'movement_id', v_movement_id::text,

      'movement_type', p_movement_type,

      'quantity', p_quantity,

      'signed_quantity', v_signed_qty,

      'new_quantity', v_new_qty,

      'out_reason_type', NULLIF(p_out_reason_type, ''),

      'reason', NULLIF(p_reason, ''),

      'purchased_with_company_cash', p_purchased_with_company_cash,

      'financial_transaction_id', CASE WHEN v_tx_id IS NULL THEN NULL ELSE v_tx_id::text END

    )

  );



  RETURN jsonb_build_object(

    'success', true,

    'product_id', v_product.id,

    'movement_id', v_movement_id,

    'financial_transaction_id', v_tx_id,

    'new_quantity', v_new_qty

  );

END;

$function$;