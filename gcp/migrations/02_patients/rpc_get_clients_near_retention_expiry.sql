CREATE OR REPLACE FUNCTION public.get_clients_near_retention_expiry(p_tenant_id uuid, p_months_ahead integer DEFAULT 12)
 RETURNS TABLE(client_id uuid, client_name text, cpf text, last_appointment date, retention_expires date, days_until_expiry integer, total_records bigint, total_prescriptions bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    c.id as client_id,

    c.name as client_name,

    c.cpf,

    c.last_appointment_date as last_appointment,

    c.retention_expires_at as retention_expires,

    (c.retention_expires_at - CURRENT_DATE)::INTEGER as days_until_expiry,

    (SELECT COUNT(*) FROM medical_records mr WHERE mr.client_id = c.id) as total_records,

    (SELECT COUNT(*) FROM prescriptions p 

     JOIN medical_records mr ON mr.id = p.medical_record_id 

     WHERE mr.client_id = c.id) as total_prescriptions

  FROM clients c

  WHERE c.tenant_id = p_tenant_id

    AND c.retention_expires_at IS NOT NULL

    AND c.retention_expires_at <= CURRENT_DATE + (p_months_ahead || ' months')::INTERVAL

    AND c.retention_expires_at >= CURRENT_DATE

  ORDER BY c.retention_expires_at ASC;

END;

$function$;