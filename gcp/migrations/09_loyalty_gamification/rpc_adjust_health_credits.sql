CREATE OR REPLACE FUNCTION public.adjust_health_credits(p_tenant_id uuid, p_patient_id uuid, p_amount integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_new_balance integer;

  v_tx_id uuid;

BEGIN

  IF p_amount = 0 THEN

    RAISE EXCEPTION 'Ajuste n├úo pode ser zero';

  END IF;



  -- Verificar se ├® admin do tenant

  IF NOT public.is_tenant_admin(current_setting('app.current_user_id')::uuid, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem fazer ajustes manuais';

  END IF;



  -- Upsert no saldo

  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, tier)

  VALUES (p_tenant_id, p_patient_id, GREATEST(p_amount, 0), 'bronze')

  ON CONFLICT (tenant_id, patient_id)

  DO UPDATE SET

    balance = GREATEST(health_credits_balance.balance + p_amount, 0),

    lifetime_earned = CASE

      WHEN p_amount > 0 THEN health_credits_balance.lifetime_earned + p_amount

      ELSE health_credits_balance.lifetime_earned

    END,

    tier = CASE

      WHEN p_amount > 0 THEN public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount)

      ELSE health_credits_balance.tier

    END,

    updated_at = now()

  RETURNING balance INTO v_new_balance;



  INSERT INTO public.health_credits_transactions (

    tenant_id, patient_id, type, amount, balance_after,

    reason, reference_type, created_by

  ) VALUES (

    p_tenant_id, p_patient_id, 'adjustment', p_amount, v_new_balance,

    p_reason, 'manual', current_setting('app.current_user_id')::uuid

  )

  RETURNING id INTO v_tx_id;



  RETURN jsonb_build_object(

    'transaction_id', v_tx_id,

    'adjusted', p_amount,

    'new_balance', v_new_balance

  );

END;

$function$;