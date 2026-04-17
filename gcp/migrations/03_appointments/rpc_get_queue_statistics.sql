CREATE OR REPLACE FUNCTION public.get_queue_statistics(p_tenant_id uuid)
 RETURNS TABLE(total_today integer, waiting_count integer, calling_count integer, in_service_count integer, completed_count integer, no_show_count integer, avg_wait_time_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT

    COUNT(*)::INTEGER,

    COUNT(*) FILTER (WHERE pc.status = 'waiting')::INTEGER,

    COUNT(*) FILTER (WHERE pc.status = 'calling')::INTEGER,

    COUNT(*) FILTER (WHERE pc.status = 'in_service')::INTEGER,

    COUNT(*) FILTER (WHERE pc.status = 'completed')::INTEGER,

    COUNT(*) FILTER (WHERE pc.status = 'no_show')::INTEGER,

    ROUND(AVG(

      CASE WHEN pc.first_called_at IS NOT NULL 

      THEN EXTRACT(EPOCH FROM (pc.first_called_at - pc.checked_in_at)) / 60 

      END

    )::NUMERIC, 1)

  FROM patient_calls pc

  WHERE pc.tenant_id = p_tenant_id

    AND pc.created_at::DATE = CURRENT_DATE;

END;

$function$;