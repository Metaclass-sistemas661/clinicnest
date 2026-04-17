CREATE OR REPLACE FUNCTION public.award_health_credits(p_tenant_id uuid, p_patient_id uuid, p_amount integer, p_reason text, p_reference_type text DEFAULT 'manual'::text, p_reference_id uuid DEFAULT NULL::uuid, p_expiry_days integer DEFAULT 365, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_new_balance integer;

  v_new_lifetime integer;

  v_new_tier text;

  v_tx_id uuid;

BEGIN

  IF p_amount <= 0 THEN

    RAISE EXCEPTION 'Quantidade de cr├®ditos deve ser positiva';

  END IF;



  -- Upsert no saldo

  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, lifetime_earned, tier)

  VALUES (p_tenant_id, p_patient_id, p_amount, p_amount, public.hc_recalc_tier(p_amount))

  ON CONFLICT (tenant_id, patient_id)

  DO UPDATE SET

    balance = health_credits_balance.balance + p_amount,

    lifetime_earned = health_credits_balance.lifetime_earned + p_amount,

    tier = public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount),

    updated_at = now()

  RETURNING balance, lifetime_earned, tier

  INTO v_new_balance, v_new_lifetime, v_new_tier;



  -- Registrar transa├º├úo

  INSERT INTO public.health_credits_transactions (

    tenant_id, patient_id, type, amount, balance_after,

    reason, reference_type, reference_id, created_by, expires_at

  ) VALUES (

    p_tenant_id, p_patient_id, 'earn', p_amount, v_new_balance,

    p_reason, p_reference_type, p_reference_id,

    COALESCE(p_created_by, current_setting('app.current_user_id')::uuid),

    CASE WHEN p_expiry_days > 0 THEN now() + (p_expiry_days || ' days')::interval ELSE NULL END

  )

  RETURNING id INTO v_tx_id;



  RETURN jsonb_build_object(

    'transaction_id', v_tx_id,

    'new_balance', v_new_balance,

    'lifetime_earned', v_new_lifetime,

    'tier', v_new_tier,

    'awarded', p_amount

  );

END;

$function$;