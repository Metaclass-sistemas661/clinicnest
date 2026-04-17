CREATE OR REPLACE FUNCTION public.apply_coupon_to_order_v1(p_code text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id uuid;

  v_coupon    discount_coupons%ROWTYPE;

  v_order     orders%ROWTYPE;

  v_discount  numeric;

BEGIN

  SELECT tenant_id INTO v_tenant_id

  FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;

  IF v_tenant_id IS NULL THEN

    RETURN jsonb_build_object('success',false,'error','unauthenticated');

  END IF;



  SELECT * INTO v_order FROM orders

  WHERE id = p_order_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN

    RETURN jsonb_build_object('success',false,'error','order_not_found');

  END IF;

  IF v_order.status NOT IN ('draft','open') THEN

    RETURN jsonb_build_object('success',false,'error','order_not_editable');

  END IF;

  IF v_order.applied_coupon_id IS NOT NULL THEN

    RETURN jsonb_build_object('success',false,'error','coupon_already_applied');

  END IF;



  -- Validate coupon

  SELECT * INTO v_coupon FROM discount_coupons

  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN

    RETURN jsonb_build_object('success',false,'error','not_found');

  END IF;

  IF NOT v_coupon.is_active THEN

    RETURN jsonb_build_object('success',false,'error','inactive');

  END IF;

  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN

    RETURN jsonb_build_object('success',false,'error','not_yet_valid');

  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN

    RETURN jsonb_build_object('success',false,'error','expired');

  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN

    RETURN jsonb_build_object('success',false,'error','max_uses_reached');

  END IF;



  -- Calculate discount

  IF v_coupon.type = 'percent' THEN

    v_discount := ROUND(v_order.subtotal_amount * v_coupon.value / 100, 2);

  ELSE

    v_discount := v_coupon.value;

  END IF;

  v_discount := LEAST(v_order.subtotal_amount, v_discount);



  -- Apply discount + increment used_count

  UPDATE orders

  SET discount_amount  = LEAST(subtotal_amount, discount_amount + v_discount),

      total_amount     = GREATEST(0, total_amount - v_discount),

      applied_coupon_id = v_coupon.id

  WHERE id = p_order_id;



  UPDATE discount_coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;



  RETURN jsonb_build_object(

    'success',          true,

    'coupon_id',        v_coupon.id,

    'discount_applied', v_discount

  );

END;

$function$;