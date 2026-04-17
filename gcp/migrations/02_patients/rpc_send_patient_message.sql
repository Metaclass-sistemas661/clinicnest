CREATE OR REPLACE FUNCTION public.send_patient_message(p_content text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid;

  v_client_id uuid;

  v_tenant_id uuid;

  v_client_name text;

  v_message_id uuid;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;

  IF p_content IS NULL OR BTRIM(p_content) = '' THEN RAISE EXCEPTION 'Mensagem n├úo pode estar vazia'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado a nenhuma cl├¡nica'; END IF;



  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_client_id;



  INSERT INTO public.patient_messages (tenant_id, client_id, sender_type, sender_user_id, sender_name, content)

  VALUES (v_tenant_id, v_client_id, 'patient', v_user_id, v_client_name, BTRIM(p_content))

  RETURNING id INTO v_message_id;



  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);

END;

$function$;