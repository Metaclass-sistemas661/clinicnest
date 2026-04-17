CREATE OR REPLACE FUNCTION public.has_treated_patient(p_user_id uuid, p_patient_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT EXISTS (

    SELECT 1

    FROM public.appointments a

    JOIN public.profiles p ON p.id = a.professional_id

    WHERE p.user_id = p_user_id

      AND a.patient_id = p_patient_id

      AND a.status <> 'cancelled'

  );

$function$;