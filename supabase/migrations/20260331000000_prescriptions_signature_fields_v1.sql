-- Migration: Adicionar campos de assinatura digital à tabela prescriptions
-- Alinha prescriptions com medical_certificates para fluxo completo de assinatura

-- 1. Adicionar campo signed_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN signed_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Adicionar campo content_hash (para verificação de integridade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN content_hash TEXT;
  END IF;
END $$;

-- 3. Adicionar campo digital_hash (alias para compatibilidade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'digital_hash'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN digital_hash TEXT;
  END IF;
END $$;

-- 4. Índice para busca por receitas assinadas
CREATE INDEX IF NOT EXISTS idx_prescriptions_signed 
  ON public.prescriptions(tenant_id, signed_at DESC) 
  WHERE signed_at IS NOT NULL;

-- 5. Função para gerar hash de receita
CREATE OR REPLACE FUNCTION public.generate_prescription_hash(
  p_prescription_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rx RECORD;
  v_payload TEXT;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_rx FROM public.prescriptions WHERE id = p_prescription_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_payload := jsonb_build_object(
    'id', v_rx.id,
    'prescription_type', COALESCE(v_rx.prescription_type, ''),
    'medications', COALESCE(v_rx.medications, ''),
    'instructions', COALESCE(v_rx.instructions, ''),
    'issued_at', COALESCE(v_rx.issued_at::TEXT, ''),
    'validity_days', COALESCE(v_rx.validity_days, 0),
    'patient_id', COALESCE(v_rx.patient_id::TEXT, ''),
    'professional_id', COALESCE(v_rx.professional_id::TEXT, '')
  )::TEXT;

  v_hash := encode(sha256(v_payload::bytea), 'hex');
  
  RETURN v_hash;
END;
$$;

-- 6. RPC para assinar receita digitalmente
CREATE OR REPLACE FUNCTION public.sign_prescription(
  p_prescription_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rx RECORD;
  v_profile RECORD;
  v_hash TEXT;
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.get_user_tenant_id(v_user_id);
  
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não vinculado a uma clínica');
  END IF;

  SELECT * INTO v_rx
  FROM public.prescriptions
  WHERE id = p_prescription_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receita não encontrada');
  END IF;

  IF v_rx.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receita já foi assinada digitalmente');
  END IF;

  SELECT full_name, council_number, council_state INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_profile.full_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil do profissional não encontrado');
  END IF;

  IF v_profile.council_number IS NULL OR v_profile.council_number = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CRM é obrigatório para assinatura digital');
  END IF;

  v_hash := public.generate_prescription_hash(p_prescription_id);

  UPDATE public.prescriptions
  SET 
    digital_signature = v_hash,
    digital_hash = v_hash,
    content_hash = v_hash,
    signed_at = NOW(),
    signed_by_name = v_profile.full_name,
    signed_by_crm = v_profile.council_number,
    signed_by_uf = v_profile.council_state,
    updated_at = NOW()
  WHERE id = p_prescription_id;

  RETURN jsonb_build_object(
    'success', true,
    'hash', v_hash,
    'signed_at', NOW()::TEXT,
    'signed_by', v_profile.full_name,
    'crm', v_profile.council_number
  );
END;
$$;

-- 7. Trigger para proteger receitas assinadas
CREATE OR REPLACE FUNCTION public.protect_signed_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    IF NEW.medications != OLD.medications 
       OR NEW.instructions IS DISTINCT FROM OLD.instructions
       OR NEW.prescription_type != OLD.prescription_type
       OR NEW.validity_days IS DISTINCT FROM OLD.validity_days
    THEN
      RAISE EXCEPTION 'Não é permitido alterar o conteúdo de uma receita assinada digitalmente.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_prescription ON public.prescriptions;
CREATE TRIGGER trg_protect_signed_prescription
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_prescription();

-- 8. Atualizar view de documentos verificáveis
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
  COALESCE(pr.digital_hash, pr.digital_signature) AS hash,
  pr.signed_at,
  pr.signed_by_name AS signer_name,
  pr.signed_by_crm AS signer_crm,
  pr.signed_by_uf AS signer_uf,
  pr.prescription_type AS doc_subtype,
  pr.created_at,
  pr.tenant_id,
  CASE WHEN (pr.digital_hash IS NOT NULL OR pr.digital_signature IS NOT NULL) AND pr.signed_at IS NOT NULL THEN true ELSE false END AS is_signed
FROM public.prescriptions pr
WHERE pr.digital_hash IS NOT NULL OR pr.digital_signature IS NOT NULL;

-- Comentários
COMMENT ON COLUMN public.prescriptions.signed_at IS 'Data/hora da assinatura digital';
COMMENT ON COLUMN public.prescriptions.content_hash IS 'Hash SHA-256 do conteúdo para verificação';
COMMENT ON COLUMN public.prescriptions.digital_hash IS 'Hash da assinatura digital';
COMMENT ON FUNCTION public.sign_prescription IS 'Assina digitalmente uma receita médica';
COMMENT ON FUNCTION public.generate_prescription_hash IS 'Gera hash SHA-256 do conteúdo de uma receita';
