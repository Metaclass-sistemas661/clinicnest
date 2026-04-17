CREATE OR REPLACE FUNCTION public.recall_patient(p_call_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE patient_calls SET

    times_called = times_called + 1,

    last_called_at = NOW(),

    updated_at = NOW()

  WHERE id = p_call_id AND status = 'calling';

END;

$function$;