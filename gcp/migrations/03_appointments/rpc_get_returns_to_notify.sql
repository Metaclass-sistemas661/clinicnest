CREATE OR REPLACE FUNCTION public.get_returns_to_notify(p_tenant_id uuid)
 RETURNS TABLE(reminder_id uuid, client_id uuid, client_name text, client_phone text, client_email text, professional_name text, return_date date, days_until_return integer, reason text, preferred_contact text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    rr.id as reminder_id,

    rr.client_id,

    c.name as client_name,

    c.phone as client_phone,

    c.email as client_email,

    p.name as professional_name,

    rr.return_date,

    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,

    rr.reason,

    rr.preferred_contact

  FROM return_reminders rr

  JOIN clients c ON c.id = rr.client_id

  LEFT JOIN profiles p ON p.id = rr.professional_id

  WHERE rr.tenant_id = p_tenant_id

    AND rr.status = 'pending'

    AND rr.notify_patient = true

    AND rr.return_date - rr.notify_days_before <= CURRENT_DATE

    AND rr.return_date >= CURRENT_DATE

    AND (rr.last_notification_at IS NULL OR rr.last_notification_at < CURRENT_DATE - INTERVAL '1 day')

  ORDER BY rr.return_date ASC;

END;

$function$;