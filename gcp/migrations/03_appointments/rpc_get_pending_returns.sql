CREATE OR REPLACE FUNCTION public.get_pending_returns(p_tenant_id uuid, p_status text DEFAULT NULL::text, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_professional_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, client_id uuid, client_name text, client_phone text, client_email text, professional_id uuid, professional_name text, service_name text, return_days integer, return_date date, days_until_return integer, days_overdue integer, reason text, status text, notify_patient boolean, last_notification_at timestamp with time zone, scheduled_appointment_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    rr.id,

    rr.client_id,

    c.name as client_name,

    c.phone as client_phone,

    c.email as client_email,

    rr.professional_id,

    p.name as professional_name,

    s.name as service_name,

    rr.return_days,

    rr.return_date,

    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,

    CASE WHEN rr.return_date < CURRENT_DATE 

      THEN (CURRENT_DATE - rr.return_date)::INTEGER 

      ELSE 0 

    END as days_overdue,

    rr.reason,

    rr.status,

    rr.notify_patient,

    rr.last_notification_at,

    rr.scheduled_appointment_id,

    rr.created_at

  FROM return_reminders rr

  JOIN clients c ON c.id = rr.client_id

  LEFT JOIN profiles p ON p.id = rr.professional_id

  LEFT JOIN services s ON s.id = rr.service_id

  WHERE rr.tenant_id = p_tenant_id

    AND (p_status IS NULL OR rr.status = p_status)

    AND (p_from_date IS NULL OR rr.return_date >= p_from_date)

    AND (p_to_date IS NULL OR rr.return_date <= p_to_date)

    AND (p_professional_id IS NULL OR rr.professional_id = p_professional_id)

  ORDER BY 

    CASE WHEN rr.status = 'pending' AND rr.return_date < CURRENT_DATE THEN 0 ELSE 1 END,

    rr.return_date ASC;

END;

$function$;