CREATE OR REPLACE FUNCTION public.get_return_statistics(p_tenant_id uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date)
 RETURNS TABLE(total_reminders bigint, pending_count bigint, notified_count bigint, scheduled_count bigint, completed_count bigint, expired_count bigint, overdue_count bigint, completion_rate numeric, avg_days_to_return numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    COUNT(*) as total_reminders,

    COUNT(*) FILTER (WHERE rr.status = 'pending') as pending_count,

    COUNT(*) FILTER (WHERE rr.status = 'notified') as notified_count,

    COUNT(*) FILTER (WHERE rr.status = 'scheduled') as scheduled_count,

    COUNT(*) FILTER (WHERE rr.status = 'completed') as completed_count,

    COUNT(*) FILTER (WHERE rr.status = 'expired') as expired_count,

    COUNT(*) FILTER (WHERE rr.status IN ('pending', 'notified') AND rr.return_date < CURRENT_DATE) as overdue_count,

    ROUND(

      COUNT(*) FILTER (WHERE rr.status = 'completed')::NUMERIC / 

      NULLIF(COUNT(*) FILTER (WHERE rr.status IN ('completed', 'expired')), 0) * 100, 

      1

    ) as completion_rate,

    ROUND(AVG(rr.return_days)::NUMERIC, 1) as avg_days_to_return

  FROM return_reminders rr

  WHERE rr.tenant_id = p_tenant_id

    AND (p_from_date IS NULL OR rr.created_at::DATE >= p_from_date)

    AND (p_to_date IS NULL OR rr.created_at::DATE <= p_to_date);

END;

$function$;