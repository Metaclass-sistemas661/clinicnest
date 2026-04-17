CREATE OR REPLACE FUNCTION public.hc_on_appointment_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rule RECORD;

  v_patient_id uuid;

  v_today_count integer;

BEGIN

  -- S├│ dispara quando status muda para 'completed'

  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN

    RETURN NEW;

  END IF;



  -- Buscar patient_id do client

  SELECT id INTO v_patient_id

  FROM public.patients

  WHERE id = NEW.client_id

    AND tenant_id = NEW.tenant_id;



  IF v_patient_id IS NULL THEN

    -- client pode n├úo ser patient (caso edge)

    RETURN NEW;

  END IF;



  -- Buscar regra ativa para appointment_completed

  FOR v_rule IN

    SELECT * FROM public.health_credits_rules

    WHERE tenant_id = NEW.tenant_id

      AND trigger_type = 'appointment_completed'

      AND is_active = true

  LOOP

    -- Verificar limite di├írio se configurado

    IF v_rule.max_per_day IS NOT NULL THEN

      SELECT COUNT(*) INTO v_today_count

      FROM public.health_credits_transactions

      WHERE tenant_id = NEW.tenant_id

        AND patient_id = v_patient_id

        AND reference_type = 'appointment'

        AND type = 'earn'

        AND created_at::date = CURRENT_DATE;



      IF v_today_count >= v_rule.max_per_day THEN

        CONTINUE;

      END IF;

    END IF;



    -- Conceder cr├®ditos

    PERFORM public.award_health_credits(

      NEW.tenant_id,

      v_patient_id,

      v_rule.points,

      'Consulta realizada ÔÇö ' || COALESCE(

        (SELECT name FROM public.services WHERE id = NEW.service_id),

        'Atendimento'

      ),

      'appointment',

      NEW.id,

      v_rule.expiry_days,

      NULL -- system action

    );

  END LOOP;



  RETURN NEW;

END;

$function$;