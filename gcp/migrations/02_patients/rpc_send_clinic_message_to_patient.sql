CREATE OR REPLACE FUNCTION public.send_clinic_message_to_patient(p_client_id uuid, p_content text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid;

  v_tenant_id uuid;

  v_sender_name text;

  v_patient_tenant_id uuid;

  v_message_id uuid;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  IF p_content IS NULL OR BTRIM(p_content) = '' THEN

    RAISE EXCEPTION 'Mensagem n├úo pode estar vazia';

  END IF;



  SELECT p.tenant_id, p.full_name INTO v_tenant_id, v_sender_name

  FROM public.profiles p

  WHERE p.id = v_user_id;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo vinculado a tenant';

  END IF;



  SELECT c.tenant_id INTO v_patient_tenant_id

  FROM public.clients c

  WHERE c.id = p_client_id;



  IF v_patient_tenant_id IS NULL OR v_patient_tenant_id != v_tenant_id THEN

    RAISE EXCEPTION 'Paciente n├úo encontrado';

  END IF;



  INSERT INTO public.patient_messages (

    tenant_id,

    patient_id,

    sender_type,

    sender_user_id,

    sender_name,

    content

  ) VALUES (

    v_tenant_id,

    p_client_id,

    'clinic',

    v_user_id,

    v_sender_name,

    BTRIM(p_content)

  )

  RETURNING id INTO v_message_id;



  RETURN jsonb_build_object(

    'success', true,

    'message_id', v_message_id

  );

END;

$function$;