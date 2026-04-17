CREATE OR REPLACE FUNCTION public.is_admin_or_faturista(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT EXISTS (

    SELECT 1 FROM public.user_roles ur

    WHERE ur.user_id = p_user_id AND ur.role = 'admin'

  )

  OR EXISTS (

    SELECT 1 FROM public.profiles p

    WHERE p.user_id = p_user_id AND p.professional_type = 'faturista'

  );

$function$;