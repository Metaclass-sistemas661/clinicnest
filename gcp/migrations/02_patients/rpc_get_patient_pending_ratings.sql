CREATE OR REPLACE FUNCTION public.get_patient_pending_ratings()
 RETURNS TABLE(appointment_id uuid, scheduled_at timestamp with time zone, completed_at timestamp with time zone, service_name text, professional_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE v_client_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id FROM public.patient_profiles pp WHERE pp.user_id=current_setting('app.current_user_id')::uuid AND pp.is_active=true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT a.id, a.scheduled_at, a.updated_at AS completed_at, COALESCE(s.name,'Consulta')::text, COALESCE(p.full_name,'')::text

  FROM public.appointments a

  LEFT JOIN public.procedures s ON s.id=a.procedure_id

  LEFT JOIN public.profiles p ON p.id=a.professional_id

  WHERE a.patient_id=v_client_id AND a.status='completed' AND a.scheduled_at > now()-interval '30 days'

    AND NOT EXISTS (SELECT 1 FROM public.appointment_ratings ar WHERE ar.appointment_id=a.id)

  ORDER BY a.scheduled_at DESC LIMIT 5;

END;

$function$;