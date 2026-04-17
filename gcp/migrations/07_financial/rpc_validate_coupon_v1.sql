CREATE OR REPLACE FUNCTION public.validate_coupon_v1(p_code text, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_coupon discount_coupons%ROWTYPE;

BEGIN

  SELECT * INTO v_coupon FROM discount_coupons

  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN

    RETURN jsonb_build_object('valid',false,'error','not_found');

  END IF;

  IF NOT v_coupon.is_active THEN

    RETURN jsonb_build_object('valid',false,'error','inactive');

  END IF;

  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN

    RETURN jsonb_build_object('valid',false,'error','not_yet_valid');

  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN

    RETURN jsonb_build_object('valid',false,'error','expired');

  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN

    RETURN jsonb_build_object('valid',false,'error','max_uses_reached');

  END IF;



  RETURN jsonb_build_object(

    'valid',        true,

    'coupon_id',    v_coupon.id,

    'type',         v_coupon.type,

    'value',        v_coupon.value,

    'service_id',   v_coupon.service_id

  );

END;

$function$;