CREATE OR REPLACE FUNCTION public.get_patient_bookable_services()
 RETURNS TABLE(id uuid, name text, description text, duration_minutes integer, price numeric, category text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado a nenhuma cl├¡nica'; END IF;



  IF NOT EXISTS (

    SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id AND t.patient_booking_enabled = true

  ) THEN

    RAISE EXCEPTION 'Agendamento online n├úo est├í habilitado para esta cl├¡nica';

  END IF;



  RETURN QUERY

  SELECT

    s.id,

    s.name,

    s.description,

    s.duration_minutes,

    s.price,

    COALESCE(s.procedure_type, s.name)::text AS category

  FROM public.procedures s

  WHERE s.tenant_id = v_tenant_id

    AND s.is_active = true

    AND s.patient_bookable = true

  ORDER BY s.name;

END;

$function$;