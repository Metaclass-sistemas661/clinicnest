CREATE OR REPLACE FUNCTION public.expire_old_returns(p_days_overdue integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_count INTEGER;

BEGIN

  UPDATE return_reminders

  SET status = 'expired', updated_at = NOW()

  WHERE status IN ('pending', 'notified')

    AND return_date < CURRENT_DATE - p_days_overdue;

  

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;

END;

$function$;