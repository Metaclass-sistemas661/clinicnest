CREATE OR REPLACE FUNCTION public.add_patient_to_queue(p_tenant_id uuid, p_patient_id uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_triage_id uuid DEFAULT NULL::uuid, p_room_id uuid DEFAULT NULL::uuid, p_professional_id uuid DEFAULT NULL::uuid, p_priority integer DEFAULT 5, p_priority_label text DEFAULT 'Normal'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_call_id UUID;

  v_existing_id UUID;

  v_call_number INTEGER;

  v_room_name TEXT;

  v_professional_name TEXT;

BEGIN

  -- Idempotente: se j├í est├í na fila hoje, retorna ID existente

  SELECT id INTO v_existing_id

  FROM patient_calls

  WHERE tenant_id = p_tenant_id

    AND patient_id = p_patient_id

    AND created_at::DATE = CURRENT_DATE

    AND status IN ('waiting', 'calling', 'in_service')

  LIMIT 1;



  IF v_existing_id IS NOT NULL THEN

    RETURN v_existing_id;

  END IF;



  v_call_number := generate_call_number(p_tenant_id);



  IF p_room_id IS NOT NULL THEN

    SELECT name INTO v_room_name FROM clinic_rooms WHERE id = p_room_id;

  END IF;



  IF p_professional_id IS NOT NULL THEN

    SELECT full_name INTO v_professional_name FROM profiles WHERE id = p_professional_id;

  END IF;



  INSERT INTO patient_calls (

    tenant_id, patient_id, appointment_id, triage_id,

    room_id, room_name, professional_id, professional_name,

    priority, priority_label, call_number, status

  ) VALUES (

    p_tenant_id, p_patient_id, p_appointment_id, p_triage_id,

    p_room_id, v_room_name, p_professional_id, v_professional_name,

    p_priority, p_priority_label, v_call_number, 'waiting'

  ) RETURNING id INTO v_call_id;



  RETURN v_call_id;

END;

$function$;