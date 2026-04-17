CREATE OR REPLACE FUNCTION public.mark_patient_no_show(p_call_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE patient_calls SET

    status = 'no_show', updated_at = NOW()

  WHERE id = p_call_id AND status IN ('waiting', 'calling');

END;

$function$;