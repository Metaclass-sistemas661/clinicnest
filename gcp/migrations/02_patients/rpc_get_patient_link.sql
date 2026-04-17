CREATE OR REPLACE FUNCTION public.get_patient_link()
 RETURNS TABLE(client_id uuid, tenant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  RETURN QUERY

  SELECT pp.client_id, pp.tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid

    AND pp.is_active = true

  LIMIT 1;

END;

$function$;