CREATE OR REPLACE FUNCTION public.get_time_slot_no_show_rate(p_tenant_id uuid, p_day_of_week integer, p_hour integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

    v_total INTEGER;

    v_no_shows INTEGER;

BEGIN

    SELECT 

        COUNT(*),

        COUNT(*) FILTER (WHERE status = 'no_show')

    INTO v_total, v_no_shows

    FROM appointments

    WHERE tenant_id = p_tenant_id

      AND EXTRACT(DOW FROM scheduled_at) = p_day_of_week

      AND EXTRACT(HOUR FROM scheduled_at) = p_hour

      AND scheduled_at >= NOW() - INTERVAL '90 days';

    

    IF v_total < 10 THEN

        RETURN 0.10; -- Default 10% if not enough data

    END IF;

    

    RETURN v_no_shows::DECIMAL / v_total::DECIMAL;

END;

$function$;