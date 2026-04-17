CREATE OR REPLACE FUNCTION public.hc_expire_credits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rec RECORD;

  v_expired_total integer := 0;

  v_remaining integer;

BEGIN

  -- Buscar transa├º├Áes earn expiradas que ainda t├¬m cr├®ditos dispon├¡veis

  FOR v_rec IN

    SELECT

      t.id,

      t.tenant_id,

      t.patient_id,

      t.amount AS original_amount,

      b.balance AS current_balance

    FROM public.health_credits_transactions t

    JOIN public.health_credits_balance b

      ON b.tenant_id = t.tenant_id AND b.patient_id = t.patient_id

    WHERE t.type = 'earn'

      AND t.expires_at IS NOT NULL

      AND t.expires_at < now()

      AND b.balance > 0

    ORDER BY t.expires_at ASC

    FOR UPDATE OF b

  LOOP

    -- Expirar no m├íximo o que o paciente tem de saldo

    v_remaining := LEAST(v_rec.original_amount, v_rec.current_balance);



    IF v_remaining <= 0 THEN

      -- Marcar como processado movendo expires_at para null

      UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;

      CONTINUE;

    END IF;



    UPDATE public.health_credits_balance

    SET balance = GREATEST(balance - v_remaining, 0),

        updated_at = now()

    WHERE tenant_id = v_rec.tenant_id AND patient_id = v_rec.patient_id;



    INSERT INTO public.health_credits_transactions (

      tenant_id, patient_id, type, amount, balance_after,

      reason, reference_type, reference_id

    ) VALUES (

      v_rec.tenant_id,

      v_rec.patient_id,

      'expire',

      -v_remaining,

      GREATEST(v_rec.current_balance - v_remaining, 0),

      'Cr├®ditos expirados',

      'expiration',

      v_rec.id -- refer├¬ncia ├á transa├º├úo original

    );



    -- Marcar transa├º├úo original como processada

    UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;



    v_expired_total := v_expired_total + v_remaining;

  END LOOP;



  RETURN v_expired_total;

END;

$function$;