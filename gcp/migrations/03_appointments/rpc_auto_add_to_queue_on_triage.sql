CREATE OR REPLACE FUNCTION public.auto_add_to_queue_on_triage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_priority INTEGER;

  v_priority_label TEXT;

BEGIN

  CASE NEW.risk_classification

    WHEN 'emergencia' THEN v_priority := 1; v_priority_label := 'Emerg├¬ncia';

    WHEN 'muito_urgente' THEN v_priority := 2; v_priority_label := 'Muito Urgente';

    WHEN 'urgente' THEN v_priority := 3; v_priority_label := 'Urgente';

    WHEN 'pouco_urgente' THEN v_priority := 4; v_priority_label := 'Pouco Urgente';

    ELSE v_priority := 5; v_priority_label := 'Normal';

  END CASE;

  

  PERFORM add_patient_to_queue(

    NEW.tenant_id,

    NEW.patient_id,

    NEW.appointment_id,

    NEW.id,

    NULL,

    NULL,

    v_priority,

    v_priority_label

  );

  

  RETURN NEW;

END;

$function$;