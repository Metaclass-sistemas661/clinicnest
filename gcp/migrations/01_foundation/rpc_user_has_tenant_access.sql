CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_user_id uuid, p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

    SELECT EXISTS (

        SELECT 1 FROM public.profiles

        WHERE user_id = p_user_id AND tenant_id = p_tenant_id

    );

$function$;