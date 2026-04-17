CREATE OR REPLACE FUNCTION public.call_next_patient(p_tenant_id uuid, p_room_id uuid DEFAULT NULL::uuid, p_professional_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(call_id uuid, patient_id uuid, client_name text, room_name text, professional_name text, call_number integer, priority integer, priority_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_call_id UUID;

  v_room_name TEXT;

  v_professional_name TEXT;

BEGIN

  IF p_room_id IS NOT NULL THEN

    SELECT r.name INTO v_room_name FROM clinic_rooms r WHERE r.id = p_room_id;

  END IF;

  IF p_professional_id IS NOT NULL THEN

    SELECT pr.full_name INTO v_professional_name FROM profiles pr WHERE pr.id = p_professional_id;

  END IF;



  SELECT pc.id INTO v_call_id

  FROM patient_calls pc

  WHERE pc.tenant_id = p_tenant_id

    AND pc.status = 'waiting'

    AND pc.created_at::DATE = CURRENT_DATE

    AND (p_room_id IS NULL OR pc.room_id = p_room_id OR pc.room_id IS NULL)

    AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id OR pc.professional_id IS NULL)

  ORDER BY pc.priority ASC, pc.checked_in_at ASC

  LIMIT 1;

  

  IF v_call_id IS NULL THEN RETURN; END IF;

  

  UPDATE patient_calls SET 

    status = 'calling',

    room_id = COALESCE(p_room_id, patient_calls.room_id),

    room_name = COALESCE(v_room_name, patient_calls.room_name),

    professional_id = COALESCE(p_professional_id, patient_calls.professional_id),

    professional_name = COALESCE(v_professional_name, patient_calls.professional_name),

    times_called = times_called + 1,

    first_called_at = COALESCE(first_called_at, NOW()),

    last_called_at = NOW(),

    updated_at = NOW()

  WHERE patient_calls.id = v_call_id;

  

  RETURN QUERY

  SELECT pc.id, pc.patient_id, c.name, pc.room_name, pc.professional_name,

    pc.call_number, pc.priority, pc.priority_label

  FROM patient_calls pc

  JOIN patients c ON c.id = pc.patient_id

  WHERE pc.id = v_call_id;

END;

$function$;