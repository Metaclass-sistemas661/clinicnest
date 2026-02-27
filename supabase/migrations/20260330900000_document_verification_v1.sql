-- Migration: Document Verification Public Access
-- Fase 50: QR Code e Verificação Pública de Documentos
-- Permite que terceiros verifiquem autenticidade de documentos assinados

-- Enum para tipos de documentos verificáveis
DO $$ BEGIN
  CREATE TYPE public.verifiable_document_type AS ENUM (
    'medical_certificate',
    'prescription',
    'medical_record',
    'clinical_evolution',
    'exam_request',
    'medical_report'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabela de log de verificações públicas
CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type verifiable_document_type NOT NULL,
  document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,
  verification_result BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier_ip INET,
  verifier_user_agent TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_document_verifications_hash ON public.document_verifications(document_hash);
CREATE INDEX IF NOT EXISTS idx_document_verifications_document ON public.document_verifications(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_verifications_tenant ON public.document_verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_verifications_verified_at ON public.document_verifications(verified_at DESC);

-- RLS: Verificações são públicas para leitura (sem autenticação)
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode inserir verificação (log público)
DROP POLICY IF EXISTS "Anyone can log verification" ON public.document_verifications;
CREATE POLICY "Anyone can log verification" ON public.document_verifications
  FOR INSERT
  WITH CHECK (true);

-- Política: Apenas tenant pode ver suas verificações
DROP POLICY IF EXISTS "Tenant can view own verifications" ON public.document_verifications;
CREATE POLICY "Tenant can view own verifications" ON public.document_verifications
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- View pública para documentos verificáveis (sem dados sensíveis)
-- Nota: Apenas medical_certificates tem estrutura completa de assinatura digital
CREATE OR REPLACE VIEW public.verifiable_documents AS
SELECT 
  'medical_certificate'::verifiable_document_type AS document_type,
  mc.id AS document_id,
  mc.digital_signature AS hash,
  mc.signed_at,
  mc.signed_by_name AS signer_name,
  mc.signed_by_crm AS signer_crm,
  mc.signed_by_uf AS signer_uf,
  mc.certificate_type AS doc_subtype,
  mc.created_at,
  mc.tenant_id,
  CASE WHEN mc.digital_signature IS NOT NULL AND mc.signed_at IS NOT NULL THEN true ELSE false END AS is_signed
FROM public.medical_certificates mc
WHERE mc.digital_signature IS NOT NULL

UNION ALL

SELECT 
  'prescription'::verifiable_document_type AS document_type,
  pr.id AS document_id,
  pr.digital_signature AS hash,
  pr.updated_at AS signed_at,
  pr.signed_by_name AS signer_name,
  pr.signed_by_crm AS signer_crm,
  pr.signed_by_uf AS signer_uf,
  pr.prescription_type AS doc_subtype,
  pr.created_at,
  pr.tenant_id,
  CASE WHEN pr.digital_signature IS NOT NULL THEN true ELSE false END AS is_signed
FROM public.prescriptions pr
WHERE pr.digital_signature IS NOT NULL;

-- RPC: Verificação pública de documento (sem autenticação)
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
  v_result JSONB;
  v_is_valid BOOLEAN := false;
  v_patient_initials TEXT;
BEGIN
  -- Buscar documento pelo hash
  SELECT * INTO v_document
  FROM public.verifiable_documents
  WHERE hash = p_hash
  LIMIT 1;

  IF v_document IS NULL THEN
    -- Documento não encontrado
    v_result := jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'Documento não encontrado ou não assinado digitalmente'
    );
  ELSE
    v_is_valid := v_document.is_signed;
    
    -- Obter iniciais do paciente (privacidade)
    SELECT 
      CASE 
        WHEN document_type = 'medical_certificate' THEN
          (SELECT CONCAT(LEFT(pat.full_name, 1), '.', LEFT(SPLIT_PART(pat.full_name, ' ', 2), 1), '.')
           FROM public.medical_certificates mc
           JOIN public.patients pat ON mc.patient_id = pat.id
           WHERE mc.id = v_document.document_id)
        WHEN document_type = 'prescription' THEN
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
    COALESCE(v_document.document_type, 'medical_certificate'),
    COALESCE(v_document.document_id, '00000000-0000-0000-0000-000000000000'::UUID),
    p_hash,
    v_is_valid,
    p_verifier_ip,
    p_verifier_user_agent,
    v_document.tenant_id
  );

  RETURN v_result;
END;
$$;

-- Conceder acesso público à função de verificação
GRANT EXECUTE ON FUNCTION public.verify_document_public(TEXT, INET, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_document_public(TEXT, INET, TEXT) TO authenticated;

-- Conceder acesso à tabela de verificações para inserção anônima
GRANT INSERT ON public.document_verifications TO anon;
GRANT SELECT, INSERT ON public.document_verifications TO authenticated;

-- Comentários
COMMENT ON TABLE public.document_verifications IS 'Log de verificações públicas de documentos assinados';
COMMENT ON FUNCTION public.verify_document_public IS 'Verifica autenticidade de documento pelo hash - acesso público';
COMMENT ON VIEW public.verifiable_documents IS 'View consolidada de documentos verificáveis';
