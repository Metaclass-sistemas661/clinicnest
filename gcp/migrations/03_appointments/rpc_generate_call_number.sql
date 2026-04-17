CREATE OR REPLACE FUNCTION public.generate_call_number(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_number INTEGER;

BEGIN

  SELECT COALESCE(MAX(call_number), 0) + 1 INTO v_number

  FROM patient_calls

  WHERE tenant_id = p_tenant_id

    AND created_at::DATE = CURRENT_DATE;

  RETURN v_number;

END;

$function$;