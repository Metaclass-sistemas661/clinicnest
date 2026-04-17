CREATE OR REPLACE FUNCTION public.get_tenant_queue_settings(p_tenant_id uuid)
 RETURNS TABLE(auto_queue_on_checkin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY SELECT t.auto_queue_on_checkin FROM tenants t WHERE t.id = p_tenant_id;

END;

$function$;