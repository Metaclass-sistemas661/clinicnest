CREATE OR REPLACE FUNCTION public.is_prescriber(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT EXISTS (

    SELECT 1 FROM public.profiles

    WHERE user_id = p_user_id

      AND professional_type IN ('medico','dentista')

  );

$function$;