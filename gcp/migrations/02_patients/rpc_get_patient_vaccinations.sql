CREATE OR REPLACE FUNCTION public.get_patient_vaccinations()
 RETURNS TABLE(id uuid, vaccine_name text, dose_number integer, batch_number text, manufacturer text, administered_at date, administered_by text, next_dose_date date)
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

    pv.id,

    pv.vaccine_name,

    pv.dose_number,

    pv.batch_number,

    pv.manufacturer,

    pv.administered_at,

    pv.administered_by,

    pv.next_dose_date

  FROM public.patient_vaccinations pv

  WHERE pv.client_id = v_client_id

  ORDER BY pv.administered_at DESC;

END;

$function$;