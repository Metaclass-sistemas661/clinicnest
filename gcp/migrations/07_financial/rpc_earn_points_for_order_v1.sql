CREATE OR REPLACE FUNCTION public.earn_points_for_order_v1(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id   uuid;

  v_order       orders%ROWTYPE;

  v_ppr         numeric;

  v_enabled     boolean;

  v_pts         integer;

  v_wallet_id   uuid;

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

  IF v_order.status <> 'paid' THEN

    RETURN jsonb_build_object('success',false,'error','order_not_paid');

  END IF;

  IF v_order.client_id IS NULL THEN

    RETURN jsonb_build_object('success',false,'skipped','no_client');

  END IF;



  SELECT points_enabled, points_per_real INTO v_enabled, v_ppr

  FROM tenants WHERE id = v_tenant_id;

  IF NOT v_enabled OR v_ppr IS NULL OR v_ppr <= 0 THEN

    RETURN jsonb_build_object('success',false,'skipped','points_disabled');

  END IF;



  v_pts := FLOOR(v_order.total_amount * v_ppr)::integer;

  IF v_pts <= 0 THEN

    RETURN jsonb_build_object('success',true,'points_earned',0);

  END IF;



  -- Upsert wallet

  INSERT INTO points_wallets(tenant_id, client_id, balance)

  VALUES (v_tenant_id, v_order.client_id, 0)

  ON CONFLICT (tenant_id, client_id) DO NOTHING;



  SELECT id INTO v_wallet_id FROM points_wallets

  WHERE tenant_id = v_tenant_id AND client_id = v_order.client_id;



  -- Idempotency: check if already earned for this order

  IF EXISTS (

    SELECT 1 FROM points_ledger

    WHERE wallet_id = v_wallet_id AND reason = 'earn' AND ref_id = p_order_id

  ) THEN

    RETURN jsonb_build_object('success',true,'skipped','already_earned');

  END IF;



  UPDATE points_wallets

  SET balance = balance + v_pts, updated_at = now()

  WHERE id = v_wallet_id;



  INSERT INTO points_ledger(wallet_id, tenant_id, client_id, delta, reason, ref_id)

  VALUES (v_wallet_id, v_tenant_id, v_order.client_id, v_pts, 'earn', p_order_id);



  RETURN jsonb_build_object('success',true,'points_earned',v_pts);

END;

$function$;