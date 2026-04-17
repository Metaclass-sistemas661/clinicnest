CREATE OR REPLACE FUNCTION public.is_slot_within_working_hours_v1(p_tenant_id uuid, p_professional_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_dow smallint;

  v_has_config boolean;

  v_row record;

  v_start_local time;

  v_end_local time;

BEGIN

  v_dow := EXTRACT(DOW FROM p_start_at)::smallint;



  SELECT EXISTS(

    SELECT 1 FROM public.professional_working_hours

    WHERE tenant_id = p_tenant_id

      AND professional_id = p_professional_id

      AND is_active = true

  ) INTO v_has_config;



  -- If no config exists, allow (backward compatible default)

  IF NOT v_has_config THEN

    RETURN true;

  END IF;



  SELECT start_time, end_time

  INTO v_row

  FROM public.professional_working_hours

  WHERE tenant_id = p_tenant_id

    AND professional_id = p_professional_id

    AND day_of_week = v_dow

    AND is_active = true;



  IF NOT FOUND THEN

    RETURN false;

  END IF;



  v_start_local := (p_start_at AT TIME ZONE 'America/Sao_Paulo')::time;

  v_end_local := (p_end_at AT TIME ZONE 'America/Sao_Paulo')::time;



  RETURN (v_start_local >= v_row.start_time) AND (v_end_local <= v_row.end_time);

END;

$function$;