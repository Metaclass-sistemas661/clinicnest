-- =====================================================
-- Sprint 1 — Cadeia de Custódia: Assinatura Híbrida + PDF Selado
-- Ref: RELATORIO-FINAL-CLINICNEST.md §10
-- Data: 2026-03-16
-- =====================================================

BEGIN;

-- =====================================================
-- PARTE 1: Novos Storage Buckets
-- consent-signatures  → PNG da assinatura manual (Canvas)
-- consent-sealed-pdfs → PDF final com validade jurídica
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-signatures',
  'consent-signatures',
  false,
  1048576,  -- 1 MB
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-sealed-pdfs',
  'consent-sealed-pdfs',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ----- Policies: consent-signatures -----

-- Paciente faz upload da própria assinatura (path: {patient_user_id}/{consent_id}.png)
CREATE POLICY "consent_signatures_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consent-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Paciente lê suas próprias assinaturas
CREATE POLICY "consent_signatures_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff do tenant lê assinaturas dos seus pacientes
CREATE POLICY "consent_signatures_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-signatures'
    AND EXISTS (
      SELECT 1
      FROM public.patient_consents pc
      WHERE pc.patient_user_id::text = (storage.foldername(name))[1]
        AND pc.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    AND public.get_user_tenant_id(auth.uid()) IS NOT NULL
  );

-- ----- Policies: consent-sealed-pdfs -----

-- Apenas a service_role (Edge Function) gera os PDFs selados
CREATE POLICY "consent_sealed_pdfs_insert_service"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (
    bucket_id = 'consent-sealed-pdfs'
  );

-- Paciente lê seus próprios PDFs (path: {tenant_id}/{patient_user_id}/{consent_id}.pdf)
CREATE POLICY "consent_sealed_pdfs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-sealed-pdfs'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Staff do tenant lê PDFs dos pacientes do tenant (path[1] = tenant_id)
CREATE POLICY "consent_sealed_pdfs_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-sealed-pdfs'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
    AND public.get_user_tenant_id(auth.uid()) IS NOT NULL
  );


-- =====================================================
-- PARTE 2: Novas colunas em patient_consents
-- Suportam assinatura híbrida + PDF selado
-- =====================================================

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS signature_method TEXT
    CHECK (signature_method IN ('facial', 'manual'));

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS manual_signature_path TEXT;

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS sealed_pdf_path TEXT;

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS sealed_pdf_hash TEXT;

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

-- Retrocompatibilidade: marcar registros existentes como 'facial'
UPDATE public.patient_consents
SET signature_method = 'facial'
WHERE signature_method IS NULL
  AND signed_at IS NOT NULL;

COMMENT ON COLUMN public.patient_consents.signature_method
  IS 'Método de assinatura: facial (câmera Banuba) ou manual (Canvas touch)';

COMMENT ON COLUMN public.patient_consents.manual_signature_path
  IS 'Path no bucket consent-signatures: {patient_user_id}/{consent_id}.png';

COMMENT ON COLUMN public.patient_consents.sealed_pdf_path
  IS 'Path no bucket consent-sealed-pdfs: {tenant_id}/{patient_user_id}/{consent_id}.pdf';

COMMENT ON COLUMN public.patient_consents.sealed_pdf_hash
  IS 'SHA-256 hex do PDF selado para verificação de integridade';

COMMENT ON COLUMN public.patient_consents.sealed_at
  IS 'Timestamp de quando o PDF selado foi gerado pela Edge Function';


-- =====================================================
-- PARTE 3: RPC sign_consent_v2
-- Assinatura híbrida: aceita facial OU manual
-- SECURITY DEFINER — bypass RLS para validações internas
-- =====================================================

CREATE OR REPLACE FUNCTION public.sign_consent_v2(
  p_consent_id    UUID    DEFAULT NULL,
  p_client_id     UUID    DEFAULT NULL,
  p_template_id   UUID    DEFAULT NULL,
  p_signature_method   TEXT DEFAULT 'facial',
  p_facial_photo_path  TEXT DEFAULT NULL,
  p_manual_signature_path TEXT DEFAULT NULL,
  p_ip_address    TEXT DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_consent_id     UUID;
  v_template       public.consent_templates%ROWTYPE;
  v_tenant_id      UUID;
  v_actual_client  UUID;
BEGIN
  -- -------------------------------------------------------
  -- 1. Autenticação
  -- -------------------------------------------------------
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  -- -------------------------------------------------------
  -- 2. Validar método de assinatura
  -- -------------------------------------------------------
  IF p_signature_method NOT IN ('facial', 'manual') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'signature_method deve ser facial ou manual');
  END IF;

  IF p_signature_method = 'facial' AND (p_facial_photo_path IS NULL OR p_facial_photo_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'facial_photo_path é obrigatório para assinatura facial');
  END IF;

  IF p_signature_method = 'manual' AND (p_manual_signature_path IS NULL OR p_manual_signature_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'manual_signature_path é obrigatório para assinatura manual');
  END IF;

  -- -------------------------------------------------------
  -- 3. Modo 1: Atualizar consent existente (p_consent_id)
  --    Modo 2: Criar novo consent (p_client_id + p_template_id)
  -- -------------------------------------------------------
  IF p_consent_id IS NOT NULL THEN
    -- Modo 1: consent pré-criado (ex: via generate_consents_for_patient)
    -- Verificar que pertence ao paciente e ainda não foi assinado
    SELECT pc.id, pc.tenant_id, pc.client_id, pc.template_id
    INTO v_consent_id, v_tenant_id, v_actual_client, p_template_id
    FROM public.patient_consents pc
    WHERE pc.id = p_consent_id
      AND pc.patient_user_id = v_user_id
    LIMIT 1;

    IF v_consent_id IS NULL THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Consentimento não encontrado ou não pertence a você');
    END IF;

    -- Verificar se já assinado (signed_at preenchido + signature_method preenchido)
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
      WHERE pc.client_id = p_client_id AND pc.template_id = p_template_id
        AND pc.signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
    END IF;

    INSERT INTO public.patient_consents (
      tenant_id, client_id, template_id, patient_user_id,
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
    ON CONFLICT (client_id, template_id) DO UPDATE SET
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

  -- -------------------------------------------------------
  -- 4. Retorno com metadados para o frontend
  --    A Edge Function seal-consent-pdf será chamada pelo
  --    frontend após receber este retorno com sucesso.
  -- -------------------------------------------------------
  RETURN jsonb_build_object(
    'success',        true,
    'consent_id',     v_consent_id,
    'template_title', v_template.title,
    'signature_method', p_signature_method,
    'sealed',         false,
    'message',        'Assinatura registrada. PDF selado será gerado em instantes.'
  );
END;
$$;

-- Grant para pacientes autenticados
GRANT EXECUTE ON FUNCTION public.sign_consent_v2(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.sign_consent_v2
  IS 'Assinatura híbrida (facial/manual) de consentimento. Retorna consent_id para disparo da Edge Function seal-consent-pdf.';


-- =====================================================
-- PARTE 4: RPC auxiliar para registrar a selagem do PDF
-- Chamada pela Edge Function seal-consent-pdf após gerar o PDF
-- Apenas service_role pode chamar
-- =====================================================

CREATE OR REPLACE FUNCTION public.seal_consent_pdf(
  p_consent_id      UUID,
  p_sealed_pdf_path TEXT,
  p_sealed_pdf_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_consents SET
    sealed_pdf_path = p_sealed_pdf_path,
    sealed_pdf_hash = p_sealed_pdf_hash,
    sealed_at       = now()
  WHERE id = p_consent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent % not found', p_consent_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success',    true,
    'consent_id', p_consent_id,
    'sealed_at',  now()
  );
END;
$$;

-- Apenas service_role (Edge Functions) pode selar
REVOKE ALL ON FUNCTION public.seal_consent_pdf(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seal_consent_pdf(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seal_consent_pdf(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.seal_consent_pdf
  IS 'Registra o PDF selado gerado pela Edge Function. Apenas service_role.';


-- =====================================================
-- PARTE 5: Índices de performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_patient_consents_signature_method
  ON public.patient_consents (signature_method)
  WHERE signature_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_consents_sealed
  ON public.patient_consents (sealed_at)
  WHERE sealed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_consents_pending_seal
  ON public.patient_consents (signed_at)
  WHERE signed_at IS NOT NULL AND sealed_at IS NULL;

COMMIT;
