CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

    SELECT EXISTS (

        SELECT 1 FROM public.user_roles

        WHERE user_id = p_user_id AND role = p_role

    );

$function$;