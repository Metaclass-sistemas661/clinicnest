CREATE OR REPLACE FUNCTION public.redeem_health_credits(p_tenant_id uuid, p_patient_id uuid, p_amount integer, p_reason text DEFAULT 'Resgate de cr├®ditos'::text, p_reference_type text DEFAULT 'manual'::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_current_balance integer;

  v_new_balance integer;

  v_tx_id uuid;

BEGIN

  IF p_amount <= 0 THEN

    RAISE EXCEPTION 'Quantidade de cr├®ditos deve ser positiva';

  END IF;



  -- Lock e verificar saldo

  SELECT balance INTO v_current_balance

  FROM public.health_credits_balance

  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id

  FOR UPDATE;



  IF v_current_balance IS NULL THEN

    RAISE EXCEPTION 'Paciente n├úo possui saldo de cr├®ditos';

  END IF;



  IF v_current_balance < p_amount THEN

    RAISE EXCEPTION 'Saldo insuficiente. Dispon├¡vel: %, solicitado: %', v_current_balance, p_amount;

  END IF;



  v_new_balance := v_current_balance - p_amount;



  UPDATE public.health_credits_balance

  SET balance = v_new_balance,

      lifetime_redeemed = lifetime_redeemed + p_amount,

      updated_at = now()

  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id;



  INSERT INTO public.health_credits_transactions (

    tenant_id, patient_id, type, amount, balance_after,

    reason, reference_type, reference_id, created_by

  ) VALUES (

    p_tenant_id, p_patient_id, 'redeem', -p_amount, v_new_balance,

    p_reason, p_reference_type, p_reference_id, current_setting('app.current_user_id')::uuid

  )

  RETURNING id INTO v_tx_id;



  RETURN jsonb_build_object(

    'transaction_id', v_tx_id,

    'redeemed', p_amount,

    'new_balance', v_new_balance

  );

END;

$function$;