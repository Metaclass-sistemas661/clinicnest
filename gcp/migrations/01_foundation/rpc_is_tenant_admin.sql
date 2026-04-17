CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id uuid, p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

    SELECT EXISTS (

        SELECT 1 FROM public.user_roles

        WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND role = 'admin'

    );

$function$;