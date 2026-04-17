CREATE OR REPLACE FUNCTION public.get_current_call(p_tenant_id uuid)
 RETURNS TABLE(call_id uuid, patient_id uuid, client_name text, call_number integer, room_name text, professional_name text, times_called integer, last_called_at timestamp with time zone, priority integer, priority_label text, appointment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    pc.id, pc.patient_id, c.name, pc.call_number,

    pc.room_name, pc.professional_name, pc.times_called, pc.last_called_at,

    pc.priority, pc.priority_label,

    pc.appointment_id

  FROM patient_calls pc

  JOIN patients c ON c.id = pc.patient_id

  WHERE pc.tenant_id = p_tenant_id

    AND pc.status = 'calling'

    AND pc.created_at::DATE = CURRENT_DATE

  ORDER BY pc.last_called_at DESC

  LIMIT 1;

END;

$function$;