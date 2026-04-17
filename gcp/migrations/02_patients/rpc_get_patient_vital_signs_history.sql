CREATE OR REPLACE FUNCTION public.get_patient_vital_signs_history(p_limit integer DEFAULT 20)
 RETURNS TABLE(recorded_at timestamp with time zone, weight numeric, height numeric, blood_pressure text, heart_rate integer, temperature numeric, oxygen_saturation numeric, glucose numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id INTO v_client_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT

    tr.triaged_at                                                   AS recorded_at,

    tr.weight_kg                                                    AS weight,

    tr.height_cm::numeric                                           AS height,

    CASE

      WHEN tr.blood_pressure_systolic IS NOT NULL

       AND tr.blood_pressure_diastolic IS NOT NULL

      THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text

      ELSE NULL

    END                                                             AS blood_pressure,

    tr.heart_rate,

    tr.temperature,

    tr.oxygen_saturation,

    NULL::numeric                                                   AS glucose

  FROM public.triage_records tr

  WHERE tr.patient_id = v_client_id

    AND (

      tr.weight_kg IS NOT NULL

      OR tr.blood_pressure_systolic IS NOT NULL

      OR tr.heart_rate IS NOT NULL

    )

  ORDER BY tr.triaged_at DESC

  LIMIT p_limit;

END;

$function$;