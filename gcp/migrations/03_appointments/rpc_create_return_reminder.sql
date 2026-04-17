CREATE OR REPLACE FUNCTION public.create_return_reminder(p_medical_record_id uuid, p_return_days integer, p_reason text DEFAULT NULL::text, p_notify_patient boolean DEFAULT true, p_notify_days_before integer DEFAULT 3, p_preferred_contact text DEFAULT 'whatsapp'::text, p_pre_schedule boolean DEFAULT false, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_record RECORD;

  v_reminder_id UUID;

  v_return_date DATE;

  v_appointment_id UUID;

BEGIN

  -- Busca dados do prontu├írio

  SELECT 

    mr.tenant_id, mr.client_id, mr.professional_id, mr.appointment_id,

    a.service_id as appt_service_id

  INTO v_record

  FROM medical_records mr

  LEFT JOIN appointments a ON a.id = mr.appointment_id

  WHERE mr.id = p_medical_record_id;

  

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Prontu├írio n├úo encontrado';

  END IF;

  

  -- Calcula data de retorno

  v_return_date := CURRENT_DATE + p_return_days;

  

  -- Cria o lembrete

  INSERT INTO return_reminders (

    tenant_id, medical_record_id, appointment_id, client_id, professional_id, service_id,

    return_days, return_date, reason, notify_patient, notify_days_before, preferred_contact,

    created_by

  ) VALUES (

    v_record.tenant_id, p_medical_record_id, v_record.appointment_id, v_record.client_id,

    v_record.professional_id, COALESCE(p_service_id, v_record.appt_service_id),

    p_return_days, v_return_date, p_reason, p_notify_patient, p_notify_days_before,

    p_preferred_contact, current_setting('app.current_user_id')::uuid

  ) RETURNING id INTO v_reminder_id;

  

  -- Atualiza o prontu├írio

  UPDATE medical_records

  SET 

    return_days = p_return_days,

    return_reason = p_reason,

    return_reminder_id = v_reminder_id,

    updated_at = NOW()

  WHERE id = p_medical_record_id;

  

  -- Se solicitado pr├®-agendamento, cria appointment com status especial

  IF p_pre_schedule THEN

    INSERT INTO appointments (

      tenant_id, client_id, professional_id, service_id, date, status, notes

    ) VALUES (

      v_record.tenant_id, v_record.client_id, v_record.professional_id,

      COALESCE(p_service_id, v_record.appt_service_id), v_return_date,

      'pending', 'Retorno autom├ítico - ' || COALESCE(p_reason, 'Consulta de retorno')

    ) RETURNING id INTO v_appointment_id;

    

    -- Vincula ao lembrete

    UPDATE return_reminders

    SET 

      scheduled_appointment_id = v_appointment_id,

      status = 'scheduled'

    WHERE id = v_reminder_id;

  END IF;

  

  RETURN v_reminder_id;

END;

$function$;