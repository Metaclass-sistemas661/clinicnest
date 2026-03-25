-- ============================================================================
-- FIX: Consent RPCs still referencing "clients" table (now "patients")
-- The table was renamed in 20260330300000_rename_clients_to_patients_v1.sql
-- but the SECURITY DEFINER functions retained the old name.
-- ============================================================================

-- 1. get_pending_consents
CREATE OR REPLACE FUNCTION public.get_pending_consents(p_client_id uuid)
RETURNS SETOF consent_templates
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ct.*
  FROM public.consent_templates ct
  JOIN public.patients c ON c.tenant_id = ct.tenant_id
  WHERE c.id = p_client_id
    AND ct.is_active = true
    AND ct.is_required = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = p_client_id
        AND pc.template_id = ct.id
    )
  ORDER BY ct.sort_order, ct.created_at;
$$;

-- 2. sign_consent
CREATE OR REPLACE FUNCTION public.sign_consent(
  p_client_id        uuid,
  p_template_id      uuid,
  p_facial_photo_path text,
  p_ip_address       text,
  p_user_agent       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template public.consent_templates%rowtype;
  v_consent_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT ct.* INTO v_template
  FROM public.consent_templates ct
  JOIN public.patients c ON c.tenant_id = ct.tenant_id
  WHERE ct.id = p_template_id
    AND c.id = p_client_id
    AND ct.is_active = true;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.patient_consents pc
    WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
  END IF;

  INSERT INTO public.patient_consents (
    tenant_id, patient_id, template_id, patient_user_id,
    facial_photo_path, ip_address, user_agent,
    template_snapshot_html
  )
  VALUES (
    v_template.tenant_id, p_client_id, p_template_id, v_user_id,
    p_facial_photo_path, p_ip_address, p_user_agent,
    v_template.body_html
  )
  RETURNING id INTO v_consent_id;

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'template_title', v_template.title
  );
END;
$$;

-- 3. sign_consent_v2  (fix the Mode 2 branch)
CREATE OR REPLACE FUNCTION public.sign_consent_v2(
  p_consent_id            uuid DEFAULT NULL,
  p_client_id             uuid DEFAULT NULL,
  p_template_id           uuid DEFAULT NULL,
  p_signature_method      text DEFAULT NULL,
  p_facial_photo_path     text DEFAULT NULL,
  p_manual_signature_path text DEFAULT NULL,
  p_ip_address            text DEFAULT NULL,
  p_user_agent            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_consent_id     UUID;
  v_template       public.consent_templates%ROWTYPE;
  v_tenant_id      UUID;
  v_actual_client  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  IF p_signature_method NOT IN ('facial', 'manual') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'signature_method deve ser facial ou manual');
  END IF;

  IF p_signature_method = 'facial' AND (p_facial_photo_path IS NULL OR p_facial_photo_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'facial_photo_path é obrigatório para assinatura facial');
  END IF;

  IF p_signature_method = 'manual' AND (p_manual_signature_path IS NULL OR p_manual_signature_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'manual_signature_path é obrigatório para assinatura manual');
  END IF;

  IF p_consent_id IS NOT NULL THEN
    -- Modo 1: consent pré-criado
    SELECT pc.id, pc.tenant_id, pc.patient_id, pc.template_id
    INTO v_consent_id, v_tenant_id, v_actual_client, p_template_id
    FROM public.patient_consents pc
    WHERE pc.id = p_consent_id
      AND pc.patient_user_id = v_user_id
    LIMIT 1;

    IF v_consent_id IS NULL THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Consentimento não encontrado ou não pertence a você');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.patient_consents
      WHERE id = p_consent_id AND signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente', 'consent_id', p_consent_id);
    END IF;

    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    WHERE ct.id = p_template_id AND ct.is_active = true;

    UPDATE public.patient_consents SET
      signed_at              = now(),
      signature_method       = p_signature_method,
      facial_photo_path      = CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE facial_photo_path END,
      manual_signature_path  = CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE manual_signature_path END,
      ip_address             = p_ip_address,
      user_agent             = p_user_agent,
      template_snapshot_html = COALESCE(template_snapshot_html, v_template.body_html)
    WHERE id = p_consent_id;

  ELSIF p_client_id IS NOT NULL AND p_template_id IS NOT NULL THEN
    -- Modo 2: criar novo consent
    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    JOIN public.patients c ON c.tenant_id = ct.tenant_id
    WHERE ct.id = p_template_id
      AND c.id = p_client_id
      AND ct.is_active = true;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id
        AND pc.signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
    END IF;

    INSERT INTO public.patient_consents (
      tenant_id, patient_id, template_id, patient_user_id,
      signed_at, signature_method,
      facial_photo_path, manual_signature_path,
      ip_address, user_agent,
      template_snapshot_html
    )
    VALUES (
      v_template.tenant_id, p_client_id, p_template_id, v_user_id,
      now(), p_signature_method,
      CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE NULL END,
      CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE NULL END,
      p_ip_address, p_user_agent,
      v_template.body_html
    )
    ON CONFLICT (patient_id, template_id) DO UPDATE SET
      signed_at              = now(),
      signature_method       = EXCLUDED.signature_method,
      facial_photo_path      = EXCLUDED.facial_photo_path,
      manual_signature_path  = EXCLUDED.manual_signature_path,
      ip_address             = EXCLUDED.ip_address,
      user_agent             = EXCLUDED.user_agent,
      template_snapshot_html = EXCLUDED.template_snapshot_html
    RETURNING id INTO v_consent_id;

  ELSE
    PERFORM public.raise_app_error('INVALID_INPUT', 'Forneça p_consent_id ou (p_client_id + p_template_id)');
  END IF;

  v_consent_id := COALESCE(v_consent_id, p_consent_id);

  RETURN jsonb_build_object(
    'success',          true,
    'consent_id',       v_consent_id,
    'template_title',   v_template.title,
    'signature_method', p_signature_method,
    'sealed',           false,
    'message',          'Assinatura registrada. PDF selado será gerado em instantes.'
  );
END;
$$;

-- 4. create_consent_signing_link
CREATE OR REPLACE FUNCTION public.create_consent_signing_link(
  p_client_id      uuid,
  p_template_ids   uuid[] DEFAULT NULL,
  p_expires_hours  int DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_token TEXT;
  v_template_ids UUID[];
  v_client_name TEXT;
  v_token_id UUID;
BEGIN
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;

  SELECT name INTO v_client_name
  FROM public.patients
  WHERE id = p_client_id AND tenant_id = v_tenant_id;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN
    SELECT array_agg(id) INTO v_template_ids
    FROM public.consent_templates
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND is_required = true;
  ELSE
    v_template_ids := p_template_ids;
  END IF;

  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum termo disponível para assinatura';
  END IF;

  v_token := generate_consent_signing_token();

  INSERT INTO public.consent_signing_tokens (
    tenant_id,
    patient_id,
    token,
    template_ids,
    expires_at,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_client_id,
    v_token,
    v_template_ids,
    now() + (p_expires_hours || ' hours')::interval,
    auth.uid()
  )
  RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'token_id', v_token_id,
    'client_name', v_client_name,
    'template_count', array_length(v_template_ids, 1),
    'expires_at', now() + (p_expires_hours || ' hours')::interval
  );
END;
$$;

-- 5. get_patient_all_consents
CREATE OR REPLACE FUNCTION public.get_patient_all_consents(p_patient_id uuid)
RETURNS TABLE (
  template_id        uuid,
  title              text,
  body_html          text,
  is_required        boolean,
  template_type      text,
  sort_order         int,
  consent_id         uuid,
  signed_at          timestamptz,
  signature_method   text,
  sealed_pdf_path    text,
  is_signed          boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ct.id            AS template_id,
    ct.title,
    ct.body_html,
    ct.is_required,
    ct.template_type,
    ct.sort_order,
    pc.id            AS consent_id,
    pc.signed_at,
    pc.signature_method,
    pc.sealed_pdf_path,
    (pc.signed_at IS NOT NULL) AS is_signed
  FROM public.consent_templates ct
  JOIN public.patients c ON c.tenant_id = ct.tenant_id
  LEFT JOIN public.patient_consents pc
    ON pc.template_id = ct.id
    AND pc.patient_id = p_patient_id
  WHERE c.id = p_patient_id
    AND ct.is_active = true
  ORDER BY
    (pc.signed_at IS NULL) DESC,
    ct.is_required DESC,
    ct.sort_order,
    ct.created_at;
$$;
