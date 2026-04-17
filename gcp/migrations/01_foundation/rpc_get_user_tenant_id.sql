CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

    SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;

$function$;