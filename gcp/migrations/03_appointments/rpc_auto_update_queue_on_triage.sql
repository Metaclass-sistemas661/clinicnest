CREATE OR REPLACE FUNCTION public.auto_update_queue_on_triage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_queue_priority INTEGER;

  v_priority_label TEXT;

BEGIN

  CASE NEW.priority

    WHEN 'emergencia' THEN v_queue_priority := 1; v_priority_label := 'Emerg├¬ncia';

    WHEN 'urgente' THEN v_queue_priority := 2; v_priority_label := 'Urgente';

    WHEN 'pouco_urgente' THEN v_queue_priority := 4; v_priority_label := 'Pouco Urgente';

    WHEN 'nao_urgente' THEN v_queue_priority := 5; v_priority_label := 'Normal';

    ELSE v_queue_priority := 5; v_priority_label := 'Normal';

  END CASE;



  IF NEW.appointment_id IS NOT NULL THEN

    UPDATE patient_calls SET 

      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,

      priority = LEAST(priority, v_queue_priority),

      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,

      updated_at = NOW()

    WHERE appointment_id = NEW.appointment_id AND tenant_id = NEW.tenant_id

      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');

  ELSE

    UPDATE patient_calls SET 

      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,

      priority = LEAST(priority, v_queue_priority),

      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,

      updated_at = NOW()

    WHERE patient_id = NEW.patient_id AND tenant_id = NEW.tenant_id

      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');

  END IF;

  RETURN NEW;

END;

$function$;