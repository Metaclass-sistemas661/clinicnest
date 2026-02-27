-- ============================================================
-- FASE: Assinatura Digital em Atestados Médicos
-- Adiciona suporte completo a assinatura digital com hash SHA-256
-- ============================================================

-- 1. Adicionar campos de assinatura à tabela medical_certificates
DO $$
BEGIN
  -- Campo para armazenar data/hora da assinatura
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN signed_at TIMESTAMPTZ;
  END IF;

  -- Nome do profissional que assinou (snapshot para auditoria)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'signed_by_name'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN signed_by_name TEXT;
  END IF;

  -- CRM do profissional que assinou (snapshot para auditoria)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'signed_by_crm'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN signed_by_crm TEXT;
  END IF;

  -- Especialidade do profissional (snapshot para auditoria)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'signed_by_specialty'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN signed_by_specialty TEXT;
  END IF;

  -- Hash do conteúdo original (para verificação de integridade)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN content_hash TEXT;
  END IF;
END $$;

-- 2. Índice para busca por documentos assinados
CREATE INDEX IF NOT EXISTS idx_medical_certificates_signed 
  ON public.medical_certificates(tenant_id, signed_at DESC) 
  WHERE signed_at IS NOT NULL;

-- 3. Função para gerar hash SHA-256 do conteúdo do atestado
CREATE OR REPLACE FUNCTION public.generate_certificate_hash(
  p_certificate_type TEXT,
  p_content TEXT,
  p_days_off INTEGER,
  p_start_date DATE,
  p_end_date DATE,
  p_cid_code TEXT,
  p_notes TEXT,
  p_patient_id UUID,
  p_issued_at TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload TEXT;
  v_hash TEXT;
BEGIN
  -- Construir payload ordenado para hash determinístico
  v_payload := jsonb_build_object(
    'certificate_type', COALESCE(p_certificate_type, ''),
    'cid_code', COALESCE(p_cid_code, ''),
    'content', COALESCE(p_content, ''),
    'days_off', COALESCE(p_days_off, 0),
    'end_date', COALESCE(p_end_date::TEXT, ''),
    'issued_at', COALESCE(p_issued_at::TEXT, ''),
    'notes', COALESCE(p_notes, ''),
    'patient_id', COALESCE(p_patient_id::TEXT, ''),
    'start_date', COALESCE(p_start_date::TEXT, '')
  )::TEXT;

  -- Gerar hash SHA-256
  v_hash := encode(sha256(v_payload::bytea), 'hex');
  
  RETURN v_hash;
END;
$$;

-- 4. Função RPC para assinar atestado digitalmente
CREATE OR REPLACE FUNCTION public.sign_medical_certificate(
  p_certificate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cert RECORD;
  v_profile RECORD;
  v_hash TEXT;
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  -- Obter tenant do usuário
  v_tenant_id := public.get_user_tenant_id(v_user_id);
  
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não vinculado a uma clínica');
  END IF;

  -- Buscar o atestado
  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não encontrado');
  END IF;

  -- Verificar se já está assinado
  IF v_cert.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado já foi assinado digitalmente');
  END IF;

  -- Buscar dados do profissional
  SELECT full_name, crm, specialty INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_profile.full_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil do profissional não encontrado');
  END IF;

  -- Verificar se o profissional tem CRM (obrigatório para assinar)
  IF v_profile.crm IS NULL OR v_profile.crm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CRM é obrigatório para assinatura digital. Atualize seu perfil.');
  END IF;

  -- Gerar hash do conteúdo
  v_hash := public.generate_certificate_hash(
    v_cert.certificate_type,
    v_cert.content,
    v_cert.days_off,
    v_cert.start_date,
    v_cert.end_date,
    v_cert.cid_code,
    v_cert.notes,
    v_cert.patient_id,
    v_cert.issued_at
  );

  -- Atualizar o atestado com a assinatura
  UPDATE public.medical_certificates
  SET 
    digital_signature = v_hash,
    content_hash = v_hash,
    signed_at = NOW(),
    signed_by_name = v_profile.full_name,
    signed_by_crm = v_profile.crm,
    signed_by_specialty = v_profile.specialty,
    updated_at = NOW()
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object(
    'success', true,
    'hash', v_hash,
    'signed_at', NOW()::TEXT,
    'signed_by', v_profile.full_name,
    'crm', v_profile.crm
  );
END;
$$;

-- 5. Função RPC para verificar integridade de um atestado assinado
CREATE OR REPLACE FUNCTION public.verify_certificate_signature(
  p_certificate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cert RECORD;
  v_current_hash TEXT;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Usuário não autorizado');
  END IF;

  -- Buscar o atestado
  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Atestado não encontrado');
  END IF;

  -- Verificar se está assinado
  IF v_cert.signed_at IS NULL OR v_cert.content_hash IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Atestado não possui assinatura digital');
  END IF;

  -- Recalcular hash do conteúdo atual
  v_current_hash := public.generate_certificate_hash(
    v_cert.certificate_type,
    v_cert.content,
    v_cert.days_off,
    v_cert.start_date,
    v_cert.end_date,
    v_cert.cid_code,
    v_cert.notes,
    v_cert.patient_id,
    v_cert.issued_at
  );

  -- Comparar hashes
  IF v_current_hash = v_cert.content_hash THEN
    RETURN jsonb_build_object(
      'valid', true,
      'message', 'Documento íntegro - conteúdo não foi alterado',
      'signed_at', v_cert.signed_at,
      'signed_by', v_cert.signed_by_name,
      'crm', v_cert.signed_by_crm,
      'hash', v_cert.content_hash
    );
  ELSE
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'ATENÇÃO: O conteúdo do documento foi alterado após a assinatura!',
      'original_hash', v_cert.content_hash,
      'current_hash', v_current_hash
    );
  END IF;
END;
$$;

-- 6. Trigger para impedir alteração de atestados assinados
CREATE OR REPLACE FUNCTION public.protect_signed_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se o documento já estava assinado, impedir alterações no conteúdo
  IF OLD.signed_at IS NOT NULL THEN
    -- Permitir apenas atualização de printed_at
    IF NEW.content != OLD.content 
       OR NEW.certificate_type != OLD.certificate_type
       OR NEW.days_off IS DISTINCT FROM OLD.days_off
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.cid_code IS DISTINCT FROM OLD.cid_code
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'Não é permitido alterar o conteúdo de um atestado assinado digitalmente. Crie um novo documento.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_certificate ON public.medical_certificates;
CREATE TRIGGER trg_protect_signed_certificate
  BEFORE UPDATE ON public.medical_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_certificate();

-- 7. Comentários de documentação
COMMENT ON COLUMN public.medical_certificates.signed_at IS 'Data/hora da assinatura digital';
COMMENT ON COLUMN public.medical_certificates.signed_by_name IS 'Nome do profissional que assinou (snapshot)';
COMMENT ON COLUMN public.medical_certificates.signed_by_crm IS 'CRM do profissional que assinou (snapshot)';
COMMENT ON COLUMN public.medical_certificates.signed_by_specialty IS 'Especialidade do profissional (snapshot)';
COMMENT ON COLUMN public.medical_certificates.content_hash IS 'Hash SHA-256 do conteúdo para verificação de integridade';
COMMENT ON COLUMN public.medical_certificates.digital_signature IS 'Assinatura digital (hash SHA-256)';

COMMENT ON FUNCTION public.sign_medical_certificate IS 'Assina digitalmente um atestado médico com hash SHA-256';
COMMENT ON FUNCTION public.verify_certificate_signature IS 'Verifica a integridade de um atestado assinado';
COMMENT ON FUNCTION public.generate_certificate_hash IS 'Gera hash SHA-256 do conteúdo de um atestado';
