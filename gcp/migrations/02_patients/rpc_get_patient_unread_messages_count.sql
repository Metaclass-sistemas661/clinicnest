CREATE OR REPLACE FUNCTION public.get_patient_unread_messages_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_count integer;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RETURN 0; END IF;



  SELECT pp.client_id INTO v_client_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RETURN 0; END IF;



  SELECT COUNT(*) INTO v_count

  FROM public.patient_messages pm

  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;



  RETURN v_count;

END;

$function$;