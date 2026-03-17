-- =====================================================
-- Migration: Extend verify_document_public for consent PDFs
-- Permite verificação pública de termos de consentimento selados
-- via /verificar/:hash (mesmo endpoint de atestados/receitas)
-- =====================================================

BEGIN;

-- Adicionar 'consent' ao enum se não existir
DO $$ BEGIN
  ALTER TYPE public.verifiable_document_type ADD VALUE IF NOT EXISTS 'consent';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Recriar a RPC para também buscar em patient_consents.sealed_pdf_hash
CREATE OR REPLACE FUNCTION public.verify_document_public(
  p_hash TEXT,
  p_verifier_ip INET DEFAULT NULL,
  p_verifier_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document RECORD;
  v_consent  RECORD;
  v_result   JSONB;
  v_is_valid BOOLEAN := false;
  v_patient_initials TEXT;
  v_doc_type TEXT;
  v_doc_id UUID;
  v_tenant_id UUID;
BEGIN
  -- 1. Buscar em documentos médicos (view existente)
  SELECT * INTO v_document
  FROM public.verifiable_documents
  WHERE hash = p_hash
  LIMIT 1;

  IF v_document IS NOT NULL THEN
    -- Documento médico encontrado (atestado, receituário etc.)
    v_is_valid := v_document.is_signed;
    v_doc_type := v_document.document_type::text;
    v_doc_id   := v_document.document_id;
    v_tenant_id := v_document.tenant_id;

    SELECT
      CASE
        WHEN v_document.document_type::text = 'medical_certificate' THEN
          (SELECT CONCAT(LEFT(pat.full_name, 1), '.', LEFT(SPLIT_PART(pat.full_name, ' ', 2), 1), '.')
           FROM public.medical_certificates mc
           JOIN public.patients pat ON mc.patient_id = pat.id
           WHERE mc.id = v_document.document_id)
        WHEN v_document.document_type::text = 'prescription' THEN
          (SELECT CONCAT(LEFT(pat.full_name, 1), '.', LEFT(SPLIT_PART(pat.full_name, ' ', 2), 1), '.')
           FROM public.prescriptions pr
           JOIN public.patients pat ON pr.patient_id = pat.id
           WHERE pr.id = v_document.document_id)
        ELSE 'N/A'
      END INTO v_patient_initials;

    v_result := jsonb_build_object(
      'found', true,
      'valid', v_is_valid,
      'document_type', v_document.document_type,
      'doc_subtype', v_document.doc_subtype,
      'signed_at', v_document.signed_at,
      'signer_name', v_document.signer_name,
      'signer_crm', v_document.signer_crm,
      'signer_uf', v_document.signer_uf,
      'created_at', v_document.created_at,
      'patient_initials', v_patient_initials,
      'hash', p_hash,
      'message', CASE
        WHEN v_is_valid THEN 'Documento válido e assinado digitalmente'
        ELSE 'Documento encontrado mas não assinado'
      END
    );

  ELSE
    -- 2. Buscar em patient_consents (termos de consentimento selados)
    SELECT
      pc.id,
      pc.tenant_id,
      pc.client_id,
      pc.signed_at,
      pc.sealed_at,
      pc.sealed_pdf_hash,
      pc.signature_method,
      ct.title AS template_title
    INTO v_consent
    FROM public.patient_consents pc
    LEFT JOIN public.consent_templates ct ON ct.id = pc.template_id
    WHERE pc.sealed_pdf_hash = p_hash
    LIMIT 1;

    IF v_consent IS NOT NULL THEN
      v_is_valid := v_consent.sealed_at IS NOT NULL;
      v_doc_type := 'consent';
      v_doc_id   := v_consent.id;
      v_tenant_id := v_consent.tenant_id;

      -- Iniciais do paciente (via clients)
      SELECT CONCAT(LEFT(c.full_name, 1), '.', LEFT(SPLIT_PART(c.full_name, ' ', 2), 1), '.')
      INTO v_patient_initials
      FROM public.clients c
      WHERE c.id = v_consent.client_id;

      v_result := jsonb_build_object(
        'found', true,
        'valid', v_is_valid,
        'document_type', 'consent',
        'doc_subtype', COALESCE(v_consent.template_title, 'Termo de Consentimento'),
        'signed_at', v_consent.signed_at,
        'sealed_at', v_consent.sealed_at,
        'signature_method', v_consent.signature_method,
        'signer_name', null,
        'signer_crm', null,
        'signer_uf', null,
        'created_at', v_consent.signed_at,
        'patient_initials', v_patient_initials,
        'hash', p_hash,
        'message', CASE
          WHEN v_is_valid THEN 'Termo de consentimento válido — PDF selado digitalmente'
          ELSE 'Termo encontrado mas PDF ainda não foi selado'
        END
      );
    ELSE
      -- Nenhum documento encontrado
      v_result := jsonb_build_object(
        'found', false,
        'valid', false,
        'message', 'Documento não encontrado ou não assinado digitalmente'
      );
    END IF;
  END IF;

  -- Registrar verificação no log
  INSERT INTO public.document_verifications (
    document_type,
    document_id,
    document_hash,
    verification_result,
    verifier_ip,
    verifier_user_agent,
    tenant_id
  ) VALUES (
    COALESCE(v_doc_type, 'medical_certificate')::verifiable_document_type,
    COALESCE(v_doc_id, '00000000-0000-0000-0000-000000000000'::UUID),
    p_hash,
    v_is_valid,
    p_verifier_ip,
    p_verifier_user_agent,
    v_tenant_id
  );

  RETURN v_result;
END;
$$;

-- Índice para busca rápida por hash do consent
CREATE INDEX IF NOT EXISTS idx_patient_consents_sealed_pdf_hash
  ON public.patient_consents (sealed_pdf_hash)
  WHERE sealed_pdf_hash IS NOT NULL;

COMMIT;
