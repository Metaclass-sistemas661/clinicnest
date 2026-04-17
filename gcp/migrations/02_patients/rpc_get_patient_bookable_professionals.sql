CREATE OR REPLACE FUNCTION public.get_patient_bookable_professionals(p_service_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, professional_type text, council_type text, council_number text, council_state text, avg_rating numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN

    RAISE EXCEPTION 'Paciente n├úo vinculado a nenhuma cl├¡nica';

  END IF;



  RETURN QUERY

  SELECT 

    p.id,

    p.full_name,

    p.avatar_url,

    p.professional_type::text,

    p.council_type,

    p.council_number,

    p.council_state,

    COALESCE(

      (SELECT AVG(ar.rating)::numeric(3,2)

       FROM public.appointment_ratings ar

       JOIN public.appointments a ON a.id = ar.appointment_id

       WHERE a.professional_id = p.id),

      0

    ) as avg_rating

  FROM public.profiles p

  WHERE p.tenant_id = v_tenant_id

    AND p.patient_bookable = true

  ORDER BY p.full_name;

END;

$function$;