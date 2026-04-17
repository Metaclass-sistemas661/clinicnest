CREATE OR REPLACE FUNCTION public.get_patient_health_info()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id   uuid;

  v_patient     public.patients%ROWTYPE;

  v_vital_signs jsonb;

  v_allergies   text;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id INTO v_client_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  SELECT * INTO v_patient FROM public.patients WHERE id = v_client_id;



  -- ├Ültimos sinais vitais registrados na triagem

  SELECT jsonb_build_object(

    'weight',            tr.weight_kg,

    'height',            tr.height_cm,

    'blood_pressure',    CASE

                           WHEN tr.blood_pressure_systolic IS NOT NULL

                            AND tr.blood_pressure_diastolic IS NOT NULL

                           THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text

                           ELSE NULL

                         END,

    'heart_rate',        tr.heart_rate,

    'temperature',       tr.temperature,

    'oxygen_saturation', tr.oxygen_saturation,

    'recorded_at',       tr.triaged_at

  ) INTO v_vital_signs

  FROM public.triage_records tr

  WHERE tr.patient_id = v_client_id

    AND (tr.weight_kg IS NOT NULL OR tr.blood_pressure_systolic IS NOT NULL)

  ORDER BY tr.triaged_at DESC

  LIMIT 1;



  -- Alergias anotadas na triagem mais recente

  SELECT tr.allergies INTO v_allergies

  FROM public.triage_records tr

  WHERE tr.patient_id = v_client_id

    AND tr.allergies IS NOT NULL

    AND tr.allergies <> ''

  ORDER BY tr.triaged_at DESC

  LIMIT 1;



  RETURN jsonb_build_object(

    'allergies',       v_allergies,

    'blood_type',      v_patient.blood_type,

    'birth_date',      v_patient.birth_date,

    'gender',          v_patient.gender,

    'last_vital_signs', COALESCE(v_vital_signs, '{}'::jsonb)

  );

END;

$function$;