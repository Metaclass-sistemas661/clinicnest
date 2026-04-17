CREATE OR REPLACE FUNCTION public.save_periogram_with_measurements(p_tenant_id uuid, p_client_id uuid, p_professional_id uuid, p_appointment_id uuid, p_exam_date date, p_notes text, p_periodontal_diagnosis text, p_risk_classification text, p_measurements jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_periogram_id UUID;

  v_measurement JSONB;

BEGIN

  -- Criar periograma (coluna renomeada para patient_id)

  INSERT INTO public.periograms (

    tenant_id, patient_id, professional_id, appointment_id,

    exam_date, notes, periodontal_diagnosis, risk_classification, created_by

  ) VALUES (

    p_tenant_id, p_client_id, p_professional_id, p_appointment_id,

    p_exam_date, p_notes, p_periodontal_diagnosis, p_risk_classification, p_professional_id

  )

  RETURNING id INTO v_periogram_id;



  -- Inserir medi├º├Áes

  FOR v_measurement IN SELECT * FROM jsonb_array_elements(p_measurements)

  LOOP

    INSERT INTO public.periogram_measurements (

      periogram_id, tooth_number, site,

      probing_depth, recession, clinical_attachment_level,

      bleeding, suppuration, plaque, mobility, furcation

    ) VALUES (

      v_periogram_id,

      (v_measurement->>'tooth_number')::INTEGER,

      v_measurement->>'site',

      (v_measurement->>'probing_depth')::INTEGER,

      (v_measurement->>'recession')::INTEGER,

      (v_measurement->>'clinical_attachment_level')::INTEGER,

      COALESCE((v_measurement->>'bleeding')::BOOLEAN, FALSE),

      COALESCE((v_measurement->>'suppuration')::BOOLEAN, FALSE),

      COALESCE((v_measurement->>'plaque')::BOOLEAN, FALSE),

      (v_measurement->>'mobility')::INTEGER,

      (v_measurement->>'furcation')::INTEGER

    );

  END LOOP;



  -- Calcular ├¡ndices

  PERFORM public.calculate_periogram_indices(v_periogram_id);



  RETURN v_periogram_id;

END;

$function$;