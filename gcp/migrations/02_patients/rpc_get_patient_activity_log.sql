CREATE OR REPLACE FUNCTION public.get_patient_activity_log(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, event_type text, event_description text, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN;

  END IF;



  RETURN QUERY

  SELECT

    pal.id,

    pal.event_type,

    pal.event_description,

    pal.metadata,

    pal.created_at

  FROM public.patient_activity_log pal

  WHERE pal.patient_user_id = v_user_id

  ORDER BY pal.created_at DESC

  LIMIT LEAST(p_limit, 100)

  OFFSET p_offset;

END;

$function$;