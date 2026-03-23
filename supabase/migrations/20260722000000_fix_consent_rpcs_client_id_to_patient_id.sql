-- ============================================================================
-- Migration: Fix ALL consent RPCs referencing client_id → patient_id
-- ============================================================================
-- Context: patient_consents, consent_signing_tokens and treatment_plans had
-- their column renamed from client_id to patient_id, but the RPCs were never
-- updated.  This migration rewrites every affected function and adds a new
-- get_patient_all_consents RPC for the patient portal "Documentos" page.
-- ============================================================================

-- ────────────────────────────────────────────────────────
-- 0. Drop existing functions that cannot be replaced in-place
-- ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.sign_consent(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.sign_consent_v2(uuid, uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.sign_consent_via_token(text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_consent_signing_link(uuid, uuid[], int);
DROP FUNCTION IF EXISTS public.get_pending_consents(uuid);
DROP FUNCTION IF EXISTS public.get_patient_all_consents(uuid);

-- ────────────────────────────────────────────────────────
-- 1. get_pending_consents  (LANGUAGE sql)
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pending_consents(p_client_id uuid)
RETURNS SETOF consent_templates
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ct.*
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
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

-- ────────────────────────────────────────────────────────
-- 2. sign_consent  (LANGUAGE plpgsql)
-- ────────────────────────────────────────────────────────
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

  -- Verificar que o template existe e pertence ao tenant do paciente
  SELECT ct.* INTO v_template
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  WHERE ct.id = p_template_id
    AND c.id = p_client_id
    AND ct.is_active = true;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
  END IF;

  -- Verificar se já foi assinado
  IF EXISTS (
    SELECT 1 FROM public.patient_consents pc
    WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
  END IF;

  -- Inserir aceite
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

-- ────────────────────────────────────────────────────────
-- 3. sign_consent_v2  (LANGUAGE plpgsql)
-- ────────────────────────────────────────────────────────
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
  -- 1. Autenticação
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  -- 2. Validar método de assinatura
  IF p_signature_method NOT IN ('facial', 'manual') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'signature_method deve ser facial ou manual');
  END IF;

  IF p_signature_method = 'facial' AND (p_facial_photo_path IS NULL OR p_facial_photo_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'facial_photo_path é obrigatório para assinatura facial');
  END IF;

  IF p_signature_method = 'manual' AND (p_manual_signature_path IS NULL OR p_manual_signature_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'manual_signature_path é obrigatório para assinatura manual');
  END IF;

  -- 3. Modo 1: Atualizar consent existente (p_consent_id)
  --    Modo 2: Criar novo consent (p_client_id + p_template_id)
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

    -- Verificar se já assinado
    IF EXISTS (
      SELECT 1 FROM public.patient_consents
      WHERE id = p_consent_id AND signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente', 'consent_id', p_consent_id);
    END IF;

    -- Buscar template para snapshot
    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    WHERE ct.id = p_template_id AND ct.is_active = true;

    -- Atualizar o consent com assinatura
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
    -- Modo 2: criar novo consent (retrocompat com sign_consent v1)
    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    JOIN public.clients c ON c.tenant_id = ct.tenant_id
    WHERE ct.id = p_template_id
      AND c.id = p_client_id
      AND ct.is_active = true;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
    END IF;

    -- Verificar duplicata
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

  -- Usar o id correto para retorno
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

-- ────────────────────────────────────────────────────────
-- 4. sign_consent_via_token  (LANGUAGE plpgsql)
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sign_consent_via_token(
  p_token            text,
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
  v_token_record RECORD;
  v_template RECORD;
  v_consent_id UUID;
  v_remaining INT;
BEGIN
  -- Buscar e validar token
  SELECT * INTO v_token_record
  FROM public.consent_signing_tokens
  WHERE token = p_token
    AND expires_at > now()
    AND used_at IS NULL;

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido, expirado ou já utilizado');
  END IF;

  -- Verificar se template está na lista permitida
  IF NOT (p_template_id = ANY(v_token_record.template_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não autorizado para este link');
  END IF;

  -- Buscar template
  SELECT * INTO v_template
  FROM public.consent_templates
  WHERE id = p_template_id
    AND tenant_id = v_token_record.tenant_id
    AND is_active = true;

  IF v_template IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não encontrado ou inativo');
  END IF;

  -- Verificar se já foi assinado
  IF EXISTS (
    SELECT 1 FROM public.patient_consents
    WHERE patient_id = v_token_record.patient_id
      AND template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este termo já foi assinado');
  END IF;

  -- Criar assinatura
  INSERT INTO public.patient_consents (
    tenant_id,
    patient_id,
    template_id,
    signed_at,
    ip_address,
    user_agent,
    facial_photo_path,
    template_snapshot_html
  )
  VALUES (
    v_token_record.tenant_id,
    v_token_record.patient_id,
    p_template_id,
    now(),
    p_ip_address,
    p_user_agent,
    p_facial_photo_path,
    v_template.body_html
  )
  RETURNING id INTO v_consent_id;

  -- Contar quantos termos ainda faltam
  SELECT COUNT(*) INTO v_remaining
  FROM public.consent_templates ct
  WHERE ct.id = ANY(v_token_record.template_ids)
    AND ct.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = v_token_record.patient_id
        AND pc.template_id = ct.id
    );

  -- Se todos foram assinados, marcar token como usado
  IF v_remaining = 0 THEN
    UPDATE public.consent_signing_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'remaining', v_remaining,
    'all_done', v_remaining = 0
  );
END;
$$;

-- ────────────────────────────────────────────────────────
-- 5. create_consent_signing_link  (LANGUAGE plpgsql)
-- ────────────────────────────────────────────────────────
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
  -- Obter tenant do usuário
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;

  -- Verificar se cliente pertence ao tenant
  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = p_client_id AND tenant_id = v_tenant_id;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  -- Se não especificou templates, pegar todos os ativos obrigatórios
  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN
    SELECT array_agg(id) INTO v_template_ids
    FROM public.consent_templates
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND is_required = true;
  ELSE
    v_template_ids := p_template_ids;
  END IF;

  -- Verificar se há templates
  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum termo disponível para assinatura';
  END IF;

  -- Gerar token
  v_token := generate_consent_signing_token();

  -- Criar registro
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

-- ────────────────────────────────────────────────────────
-- 6. trg_auto_generate_consents_on_plan_approval
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_auto_generate_consents_on_plan_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_patient_user_id UUID;
BEGIN
  -- Só dispara quando status muda para 'aprovado'
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- Buscar o user_id do paciente via patient_profiles
  SELECT pp.user_id INTO v_patient_user_id
  FROM public.patient_profiles pp
  WHERE pp.client_id = NEW.patient_id
    AND pp.tenant_id = NEW.tenant_id
    AND pp.is_active = true
  LIMIT 1;

  -- Se paciente não tem conta no portal, não gera consents automáticos
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada consent_template ativo e obrigatório do tenant
  FOR v_template IN
    SELECT ct.id, ct.title, ct.body_html, ct.tenant_id
    FROM public.consent_templates ct
    WHERE ct.tenant_id = NEW.tenant_id
      AND ct.is_active = true
      AND ct.is_required = true
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_consents pc
        WHERE pc.patient_id = NEW.patient_id
          AND pc.template_id = ct.id
      )
  LOOP
    INSERT INTO public.patient_consents (
      tenant_id,
      patient_id,
      template_id,
      patient_user_id,
      template_snapshot_html,
      signed_at
    )
    VALUES (
      v_template.tenant_id,
      NEW.patient_id,
      v_template.id,
      v_patient_user_id,
      v_template.body_html,
      NOW()
    )
    ON CONFLICT (patient_id, template_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────
-- 7. NEW RPC: get_patient_all_consents
--    Returns all consent templates for the patient's tenant
--    together with their signing status (pending vs signed).
-- ────────────────────────────────────────────────────────
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
    (pc.signature_method IS NOT NULL) AS is_signed
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  LEFT JOIN public.patient_consents pc
    ON pc.template_id = ct.id
    AND pc.patient_id = p_patient_id
  WHERE c.id = p_patient_id
    AND ct.is_active = true
  ORDER BY
    (pc.signature_method IS NULL) DESC,   -- pendentes primeiro
    ct.is_required DESC,
    ct.sort_order,
    ct.created_at;
$$;
