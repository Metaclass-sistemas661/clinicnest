CREATE OR REPLACE FUNCTION public.get_waiting_queue(p_tenant_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(call_id uuid, patient_id uuid, client_name text, call_number integer, priority integer, priority_label text, room_name text, professional_name text, checked_in_at timestamp with time zone, wait_time_minutes integer, queue_position integer, appointment_id uuid, service_name text, is_triaged boolean, triage_priority text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    pc.id, pc.patient_id, c.name, pc.call_number, pc.priority, pc.priority_label,

    pc.room_name, pc.professional_name, pc.checked_in_at,

    EXTRACT(EPOCH FROM (NOW() - pc.checked_in_at))::INTEGER / 60,

    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER,

    pc.appointment_id, pr.name,

    COALESCE(pc.is_triaged, FALSE), pc.triage_priority

  FROM patient_calls pc

  JOIN patients c ON c.id = pc.patient_id

  LEFT JOIN appointments a ON a.id = pc.appointment_id

  LEFT JOIN procedures pr ON pr.id = a.procedure_id

  WHERE pc.tenant_id = p_tenant_id

    AND pc.status = 'waiting'

    AND pc.created_at::DATE = CURRENT_DATE

  ORDER BY pc.priority ASC, pc.checked_in_at ASC

  LIMIT p_limit;

END;

$function$;