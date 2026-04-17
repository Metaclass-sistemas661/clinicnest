CREATE OR REPLACE FUNCTION public.export_patient_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_patient RECORD;

  v_result jsonb;

  v_appointments jsonb;

  v_prescriptions jsonb;

  v_certificates jsonb;

  v_exams jsonb;

  v_messages jsonb;

  v_consents jsonb;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('error', 'N├úo autenticado');

  END IF;



  -- Find patient

  SELECT p.id, p.name, p.email, p.phone, p.cpf, p.birth_date,

         p.gender, p.address, p.city, p.state, p.zip_code,

         p.tenant_id, p.created_at,

         t.name AS clinic_name

  INTO v_patient

  FROM public.patients p

  LEFT JOIN public.tenants t ON t.id = p.tenant_id

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF v_patient IS NULL THEN

    RETURN jsonb_build_object('error', 'Paciente n├úo encontrado');

  END IF;



  -- Appointments

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', a.date,

    'time', a.time,

    'status', a.status,

    'service', s.name,

    'professional', st.name,

    'notes', a.notes,

    'created_at', a.created_at

  ) ORDER BY a.date DESC), '[]'::jsonb)

  INTO v_appointments

  FROM public.appointments a

  LEFT JOIN public.services s ON s.id = a.service_id

  LEFT JOIN public.staff st ON st.id = a.staff_id

  WHERE a.patient_id = v_patient.id;



  -- Prescriptions

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', pr.created_at,

    'medications', pr.medications,

    'notes', pr.notes

  ) ORDER BY pr.created_at DESC), '[]'::jsonb)

  INTO v_prescriptions

  FROM public.prescriptions pr

  WHERE pr.patient_id = v_patient.id;



  -- Certificates

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', c.created_at,

    'type', c.type,

    'content', c.content

  ) ORDER BY c.created_at DESC), '[]'::jsonb)

  INTO v_certificates

  FROM public.certificates c

  WHERE c.patient_id = v_patient.id;



  -- Exams

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', e.created_at,

    'name', e.name,

    'status', e.status

  ) ORDER BY e.created_at DESC), '[]'::jsonb)

  INTO v_exams

  FROM public.exams e

  WHERE e.patient_id = v_patient.id;



  -- Messages

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', m.created_at,

    'content', m.content,

    'sender', m.sender_type

  ) ORDER BY m.created_at DESC), '[]'::jsonb)

  INTO v_messages

  FROM public.messages m

  WHERE m.patient_id = v_patient.id;



  -- Consents

  SELECT COALESCE(jsonb_agg(jsonb_build_object(

    'date', pc.signed_at,

    'document', pc.document_title,

    'ip', pc.ip_address

  ) ORDER BY pc.signed_at DESC), '[]'::jsonb)

  INTO v_consents

  FROM public.patient_consents pc

  WHERE pc.patient_id = v_patient.id;



  -- Build final result

  v_result := jsonb_build_object(

    'export_date', now(),

    'patient', jsonb_build_object(

      'name', v_patient.name,

      'email', v_patient.email,

      'phone', v_patient.phone,

      'cpf', v_patient.cpf,

      'birth_date', v_patient.birth_date,

      'gender', v_patient.gender,

      'address', v_patient.address,

      'city', v_patient.city,

      'state', v_patient.state,

      'zip_code', v_patient.zip_code,

      'registered_at', v_patient.created_at,

      'clinic', v_patient.clinic_name

    ),

    'appointments', v_appointments,

    'prescriptions', v_prescriptions,

    'certificates', v_certificates,

    'exams', v_exams,

    'messages', v_messages,

    'consents', v_consents

  );



  RETURN v_result;

END;

$function$;