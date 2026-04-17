CREATE OR REPLACE FUNCTION public.redeem_voucher_v1(p_code text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id uuid;

  v_voucher   vouchers%ROWTYPE;

  v_order     orders%ROWTYPE;

BEGIN

  -- Resolve caller tenant

  SELECT tenant_id INTO v_tenant_id

  FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;

  IF v_tenant_id IS NULL THEN

    RETURN jsonb_build_object('success',false,'error','unauthenticated');

  END IF;



  -- Fetch order

  SELECT * INTO v_order FROM orders

  WHERE id = p_order_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN

    RETURN jsonb_build_object('success',false,'error','order_not_found');

  END IF;

  IF v_order.status NOT IN ('draft','open') THEN

    RETURN jsonb_build_object('success',false,'error','order_not_editable');

  END IF;

  IF v_order.applied_voucher_id IS NOT NULL THEN

    RETURN jsonb_build_object('success',false,'error','voucher_already_applied');

  END IF;



  -- Fetch voucher

  SELECT * INTO v_voucher FROM vouchers

  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN

    RETURN jsonb_build_object('success',false,'error','voucher_not_found');

  END IF;

  IF v_voucher.status <> 'ativo' THEN

    RETURN jsonb_build_object('success',false,'error','voucher_inactive');

  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN

    UPDATE vouchers SET status='expirado' WHERE id = v_voucher.id;

    RETURN jsonb_build_object('success',false,'error','voucher_expired');

  END IF;



  -- Apply: set discount and mark voucher

  UPDATE orders

  SET discount_amount    = LEAST(subtotal_amount, discount_amount + v_voucher.valor),

      total_amount       = GREATEST(0, total_amount - v_voucher.valor),

      applied_voucher_id = v_voucher.id

  WHERE id = p_order_id;



  -- Mark voucher redeemed

  UPDATE vouchers SET status='resgatado' WHERE id = v_voucher.id;



  -- Ledger entry

  INSERT INTO voucher_redemptions(voucher_id, tenant_id, order_id, redeemed_by)

  VALUES (v_voucher.id, v_tenant_id, p_order_id, current_setting('app.current_user_id')::uuid);



  RETURN jsonb_build_object(

    'success', true,

    'voucher_id', v_voucher.id,

    'discount_applied', v_voucher.valor

  );

END;

$function$;