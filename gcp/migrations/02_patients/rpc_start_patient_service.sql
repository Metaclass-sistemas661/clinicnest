CREATE OR REPLACE FUNCTION public.start_patient_service(p_call_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE patient_calls SET

    status = 'in_service',

    started_service_at = NOW(),

    updated_at = NOW()

  WHERE id = p_call_id AND status = 'calling';

END;

$function$;