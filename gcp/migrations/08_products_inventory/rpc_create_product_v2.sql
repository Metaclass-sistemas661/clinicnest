CREATE OR REPLACE FUNCTION public.create_product_v2(p_name text, p_description text DEFAULT NULL::text, p_cost numeric DEFAULT 0, p_sale_price numeric DEFAULT 0, p_quantity integer DEFAULT 0, p_min_quantity integer DEFAULT 5, p_category_id uuid DEFAULT NULL::uuid, p_purchased_with_company_cash boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_product_id uuid;

  v_tx_id uuid;

  v_cost numeric;

  v_qty integer;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode cadastrar produto');

  END IF;



  IF p_name IS NULL OR btrim(p_name) = '' THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome do produto ├® obrigat├│rio');

  END IF;



  v_cost := COALESCE(p_cost, 0);

  IF v_cost < 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Custo inv├ílido');

  END IF;



  v_qty := COALESCE(p_quantity, 0);

  IF v_qty < 0 THEN

    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Quantidade inv├ílida');

  END IF;



  INSERT INTO public.products (

    tenant_id,

    name,

    description,

    cost,

    sale_price,

    quantity,

    min_quantity,

    category_id

  ) VALUES (

    v_profile.tenant_id,

    p_name,

    NULLIF(p_description, ''),

    v_cost,

    COALESCE(p_sale_price, 0),

    v_qty,

    COALESCE(p_min_quantity, 5),

    p_category_id

  )

  RETURNING id INTO v_product_id;



  IF p_purchased_with_company_cash IS TRUE AND v_qty > 0 AND v_cost > 0 THEN

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

      'Compra de Produto',

      v_cost * v_qty,

      'Compra de estoque: ' || p_name || ' (' || v_qty || ' un.)',

      current_date,

      v_product_id

    ) RETURNING id INTO v_tx_id;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'product_created',

    'product',

    v_product_id::text,

    jsonb_build_object(

      'quantity', v_qty,

      'cost', v_cost,

      'sale_price', COALESCE(p_sale_price, 0),

      'category_id', p_category_id,

      'purchased_with_company_cash', p_purchased_with_company_cash,

      'financial_transaction_id', CASE WHEN v_tx_id IS NULL THEN NULL ELSE v_tx_id::text END

    )

  );



  RETURN jsonb_build_object('success', true, 'product_id', v_product_id, 'financial_transaction_id', v_tx_id);

END;

$function$;