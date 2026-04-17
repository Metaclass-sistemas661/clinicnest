CREATE OR REPLACE FUNCTION public.sign_consent_v2(p_consent_id uuid DEFAULT NULL::uuid, p_client_id uuid DEFAULT NULL::uuid, p_template_id uuid DEFAULT NULL::uuid, p_signature_method text DEFAULT NULL::text, p_facial_photo_path text DEFAULT NULL::text, p_manual_signature_path text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id        UUID := current_setting('app.current_user_id')::uuid;

  v_consent_id     UUID;

  v_template       public.consent_templates%ROWTYPE;

  v_tenant_id      UUID;

  v_actual_client  UUID;

  v_doc_hash       TEXT;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  IF p_signature_method NOT IN ('facial', 'manual') THEN

    PERFORM public.raise_app_error('INVALID_INPUT', 'signature_method deve ser facial ou manual');

  END IF;



  IF p_signature_method = 'facial' AND (p_facial_photo_path IS NULL OR p_facial_photo_path = '') THEN

    PERFORM public.raise_app_error('INVALID_INPUT', 'facial_photo_path ├® obrigat├│rio para assinatura facial');

  END IF;



  IF p_signature_method = 'manual' AND (p_manual_signature_path IS NULL OR p_manual_signature_path = '') THEN

    PERFORM public.raise_app_error('INVALID_INPUT', 'manual_signature_path ├® obrigat├│rio para assinatura manual');

  END IF;



  -- Modo 1: Atualizar consent existente

  IF p_consent_id IS NOT NULL THEN

    SELECT pc.id, pc.tenant_id, pc.patient_id, pc.template_id

    INTO v_consent_id, v_tenant_id, v_actual_client, p_template_id

    FROM public.patient_consents pc

    WHERE pc.id = p_consent_id

      AND pc.patient_user_id = v_user_id

    LIMIT 1;



    IF v_consent_id IS NULL THEN

      PERFORM public.raise_app_error('NOT_FOUND', 'Consentimento n├úo encontrado ou n├úo pertence a voc├¬');

    END IF;



    IF EXISTS (

      SELECT 1 FROM public.patient_consents

      WHERE id = p_consent_id AND signature_method IS NOT NULL

    ) THEN

      RETURN jsonb_build_object('success', true, 'message', 'Termo j├í assinado anteriormente', 'consent_id', p_consent_id);

    END IF;



    SELECT ct.* INTO v_template

    FROM public.consent_templates ct

    WHERE ct.id = p_template_id AND ct.is_active = true;



    -- Compute hash

    v_doc_hash := encode(digest(COALESCE(v_template.body_html, '')::bytea, 'sha256'), 'hex');



    UPDATE public.patient_consents SET

      signed_at              = now(),

      signature_method       = p_signature_method,

      facial_photo_path      = CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE facial_photo_path END,

      manual_signature_path  = CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE manual_signature_path END,

      ip_address             = p_ip_address,

      user_agent             = p_user_agent,

      template_snapshot_html = COALESCE(template_snapshot_html, v_template.body_html),

      document_hash          = v_doc_hash

    WHERE id = p_consent_id;



  ELSIF p_client_id IS NOT NULL AND p_template_id IS NOT NULL THEN

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

        AND pc.signature_method IS NOT NULL

    ) THEN

      RETURN jsonb_build_object('success', true, 'message', 'Termo j├í assinado anteriormente');

    END IF;



    -- Compute hash

    v_doc_hash := encode(digest(v_template.body_html::bytea, 'sha256'), 'hex');



    INSERT INTO public.patient_consents (

      tenant_id, patient_id, template_id, patient_user_id,

      signed_at, signature_method,

      facial_photo_path, manual_signature_path,

      ip_address, user_agent,

      template_snapshot_html, document_hash

    )

    VALUES (

      v_template.tenant_id, p_client_id, p_template_id, v_user_id,

      now(), p_signature_method,

      CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE NULL END,

      CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE NULL END,

      p_ip_address, p_user_agent,

      v_template.body_html, v_doc_hash

    )

    ON CONFLICT (patient_id, template_id) DO UPDATE SET

      signed_at              = now(),

      signature_method       = EXCLUDED.signature_method,

      facial_photo_path      = EXCLUDED.facial_photo_path,

      manual_signature_path  = EXCLUDED.manual_signature_path,

      ip_address             = EXCLUDED.ip_address,

      user_agent             = EXCLUDED.user_agent,

      template_snapshot_html = EXCLUDED.template_snapshot_html,

      document_hash          = EXCLUDED.document_hash

    RETURNING id INTO v_consent_id;



  ELSE

    PERFORM public.raise_app_error('INVALID_INPUT', 'Informe consent_id ou client_id + template_id');

  END IF;



  v_consent_id := COALESCE(v_consent_id, p_consent_id);



  RETURN jsonb_build_object(

    'success', true,

    'consent_id', v_consent_id,

    'template_title', v_template.title

  );

END;

$function$;