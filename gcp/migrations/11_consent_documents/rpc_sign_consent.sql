CREATE OR REPLACE FUNCTION public.sign_consent(p_client_id uuid, p_template_id uuid, p_facial_photo_path text, p_ip_address text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_template public.consent_templates%rowtype;

  v_consent_id uuid;

  v_doc_hash text;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT ct.* INTO v_template

  FROM public.consent_templates ct

  JOIN public.clients c ON c.tenant_id = ct.tenant_id

  WHERE ct.id = p_template_id

    AND c.id = p_client_id

    AND ct.is_active = true;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Termo n├úo encontrado');

  END IF;



  IF EXISTS (

    SELECT 1 FROM public.patient_consents pc

    WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id

  ) THEN

    RETURN jsonb_build_object('success', true, 'message', 'Termo j├í assinado anteriormente');

  END IF;



  -- Compute SHA-256 hash of the document content

  v_doc_hash := encode(digest(v_template.body_html::bytea, 'sha256'), 'hex');



  INSERT INTO public.patient_consents (

    tenant_id, patient_id, template_id, patient_user_id,

    facial_photo_path, ip_address, user_agent,

    template_snapshot_html, document_hash, signed_at

  )

  VALUES (

    v_template.tenant_id, p_client_id, p_template_id, v_user_id,

    p_facial_photo_path, p_ip_address, p_user_agent,

    v_template.body_html, v_doc_hash, now()

  )

  RETURNING id INTO v_consent_id;



  RETURN jsonb_build_object(

    'success', true,

    'consent_id', v_consent_id,

    'template_title', v_template.title

  );

END;

$function$;