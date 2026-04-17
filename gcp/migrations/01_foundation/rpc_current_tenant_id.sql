CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$

    SELECT public.get_user_tenant_id(public.current_user_id());

$function$;