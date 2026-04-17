CREATE OR REPLACE FUNCTION public.get_patient_achievements()
 RETURNS TABLE(achievement_type text, achievement_name text, achieved_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_user_id uuid;

BEGIN

  v_patient_user_id := current_setting('app.current_user_id')::uuid;

  IF v_patient_user_id IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  RETURN QUERY

  SELECT 

    pa.achievement_type,

    pa.achievement_name,

    pa.achieved_at

  FROM public.patient_achievements pa

  WHERE pa.patient_user_id = v_patient_user_id

  ORDER BY pa.achieved_at DESC;

END;

$function$;