CREATE OR REPLACE FUNCTION public.get_patient_messages(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, sender_type text, sender_name text, content text, read_at timestamp with time zone, created_at timestamp with time zone)
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

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  -- Marcar mensagens da cl├¡nica como lidas

  UPDATE public.patient_messages pm

  SET read_at = now()

  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;



  RETURN QUERY

  SELECT pm.id, pm.sender_type, pm.sender_name, pm.content, pm.read_at, pm.created_at

  FROM public.patient_messages pm

  WHERE pm.client_id = v_client_id

  ORDER BY pm.created_at DESC LIMIT p_limit OFFSET p_offset;

END;

$function$;