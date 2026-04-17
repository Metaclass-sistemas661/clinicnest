CREATE OR REPLACE FUNCTION public.get_patient_dependents()
 RETURNS TABLE(dependent_id uuid, dependent_name text, relationship text, email text, phone text, birth_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE v_patient_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;

  SELECT pp.client_id INTO v_patient_id FROM public.patient_profiles pp WHERE pp.user_id=current_setting('app.current_user_id')::uuid AND pp.is_active=true LIMIT 1;

  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT pd.id AS dependent_id, p.name AS dependent_name, pd.relationship, p.email, p.phone, p.date_of_birth AS birth_date

  FROM public.patient_dependents pd JOIN public.patients p ON p.id=pd.dependent_patient_id

  WHERE pd.parent_patient_id=v_patient_id AND pd.is_active=true ORDER BY p.name;

END;

$function$;