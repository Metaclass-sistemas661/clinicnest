CREATE OR REPLACE FUNCTION public.patient_online_checkin(p_appointment_id uuid, p_form_responses jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id       uuid;

  v_patient_id    uuid;

  v_appt          record;

  v_hours_until   numeric;

  v_form_id       uuid;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'N├úo autenticado');

  END IF;



  -- Busca patient_id do user

  SELECT pp.client_id INTO v_patient_id

  FROM patient_profiles pp

  WHERE pp.user_id = v_user_id AND pp.is_active = true

  LIMIT 1;



  IF v_patient_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Perfil de paciente n├úo encontrado');

  END IF;



  -- Busca appointment

  SELECT a.* INTO v_appt

  FROM appointments a

  WHERE a.id = p_appointment_id

    AND (a.client_id = v_patient_id OR a.patient_id = v_patient_id);



  IF v_appt IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Consulta n├úo encontrada');

  END IF;



  IF v_appt.status NOT IN ('pending', 'confirmed') THEN

    RETURN jsonb_build_object('success', false, 'message', 'Esta consulta n├úo pode receber check-in');

  END IF;



  -- Check-in permitido at├® 24h antes

  v_hours_until := EXTRACT(EPOCH FROM (v_appt.scheduled_at - NOW())) / 3600;

  IF v_hours_until > 24 THEN

    RETURN jsonb_build_object('success', false, 'message', 'Check-in dispon├¡vel at├® 24h antes da consulta');

  END IF;



  IF v_hours_until < -2 THEN

    RETURN jsonb_build_object('success', false, 'message', 'A consulta j├í passou');

  END IF;



  -- Salva respostas do question├írio se fornecidas

  IF p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb THEN

    -- Busca form_id aplic├ível

    SELECT f.id INTO v_form_id

    FROM pre_consultation_forms f

    WHERE f.tenant_id = v_appt.tenant_id

      AND f.is_active = true

      AND (f.service_id = v_appt.service_id OR f.service_id IS NULL)

    ORDER BY

      CASE WHEN f.service_id = v_appt.service_id THEN 0 ELSE 1 END

    LIMIT 1;



    IF v_form_id IS NOT NULL THEN

      INSERT INTO pre_consultation_responses (

        tenant_id, appointment_id, form_id, patient_id, responses

      ) VALUES (

        v_appt.tenant_id, p_appointment_id, v_form_id, v_patient_id, p_form_responses

      )

      ON CONFLICT DO NOTHING;

    END IF;

  END IF;



  -- Marca check-in + confirma presen├ºa

  UPDATE appointments

  SET

    status = 'confirmed',

    confirmed_at = COALESCE(confirmed_at, NOW()),

    checkin_at = NOW(),

    checkin_method = 'online',

    updated_at = NOW()

  WHERE id = p_appointment_id;



  -- Cria notifica├º├úo para o profissional

  IF v_appt.professional_id IS NOT NULL THEN

    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)

    SELECT

      p.user_id,

      v_appt.tenant_id,

      'checkin_online',

      'Check-in Online',

      (SELECT c.name FROM clients c WHERE c.id = v_patient_id) || ' fez check-in online',

      jsonb_build_object(

        'appointment_id', p_appointment_id,

        'patient_id', v_patient_id,

        'checkin_method', 'online',

        'has_preconsultation', (p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb)

      )

    FROM profiles p

    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;

  END IF;



  RETURN jsonb_build_object('success', true, 'message', 'Check-in realizado com sucesso!');

END;

$function$;