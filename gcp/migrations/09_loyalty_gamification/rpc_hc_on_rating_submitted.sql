CREATE OR REPLACE FUNCTION public.hc_on_rating_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rule RECORD;

  v_appointment RECORD;

  v_patient_id uuid;

BEGIN

  -- Buscar dados do appointment

  SELECT a.tenant_id, a.client_id

  INTO v_appointment

  FROM public.appointments a

  WHERE a.id = NEW.appointment_id;



  IF v_appointment IS NULL THEN

    RETURN NEW;

  END IF;



  v_patient_id := v_appointment.client_id;



  FOR v_rule IN

    SELECT * FROM public.health_credits_rules

    WHERE tenant_id = v_appointment.tenant_id

      AND trigger_type = 'review'

      AND is_active = true

  LOOP

    -- N├úo premiar duplicado para mesmo appointment

    IF EXISTS (

      SELECT 1 FROM public.health_credits_transactions

      WHERE tenant_id = v_appointment.tenant_id

        AND patient_id = v_patient_id

        AND reference_type = 'review'

        AND reference_id = NEW.appointment_id

    ) THEN

      CONTINUE;

    END IF;



    PERFORM public.award_health_credits(

      v_appointment.tenant_id,

      v_patient_id,

      v_rule.points,

      'Avalia├º├úo do atendimento',

      'review',

      NEW.appointment_id,

      v_rule.expiry_days,

      NULL

    );

  END LOOP;



  RETURN NEW;

END;

$function$;