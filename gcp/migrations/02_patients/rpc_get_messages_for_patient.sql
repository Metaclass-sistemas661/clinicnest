CREATE OR REPLACE FUNCTION public.get_messages_for_patient(p_client_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, sender_type text, sender_name text, content text, read_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid;

  v_tenant_id uuid;

  v_patient_tenant_id uuid;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  SELECT p.tenant_id INTO v_tenant_id

  FROM public.profiles p

  WHERE p.id = v_user_id;



  SELECT c.tenant_id INTO v_patient_tenant_id

  FROM public.clients c

  WHERE c.id = p_client_id;



  IF v_patient_tenant_id IS NULL OR v_patient_tenant_id != v_tenant_id THEN

    RAISE EXCEPTION 'Paciente n├úo encontrado';

  END IF;



  -- Marcar mensagens do paciente como lidas

  UPDATE public.patient_messages pm

  SET read_at = now()

  WHERE pm.patient_id = p_client_id

    AND pm.sender_type = 'patient'

    AND pm.read_at IS NULL;



  RETURN QUERY

  SELECT 

    pm.id,

    pm.sender_type,

    pm.sender_name,

    pm.content,

    pm.read_at,

    pm.created_at

  FROM public.patient_messages pm

  WHERE pm.patient_id = p_client_id

  ORDER BY pm.created_at ASC

  LIMIT p_limit;

END;

$function$;