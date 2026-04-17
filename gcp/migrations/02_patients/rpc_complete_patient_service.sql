CREATE OR REPLACE FUNCTION public.complete_patient_service(p_call_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_triage_id UUID;

BEGIN

  UPDATE patient_calls SET 

    status = 'completed', completed_at = NOW(), updated_at = NOW()

  WHERE id = p_call_id

  RETURNING triage_id INTO v_triage_id;



  IF v_triage_id IS NOT NULL THEN

    UPDATE triage_records SET status = 'concluida'

    WHERE id = v_triage_id AND status != 'concluida';

  END IF;

END;

$function$;