-- ============================================================
-- FASE 49: Campos CFM Obrigatórios em Prontuário Eletrônico
-- Arquivo: 20260330800000_cfm_required_fields_v1.sql
-- Descrição: Adiciona campos obrigatórios conforme CFM 1.821/2007
--   - UF do profissional (signed_by_uf)
--   - Número sequencial de atendimento (attendance_number)
--   - Tipo de atendimento (attendance_type)
--   - Carimbo de tempo do servidor (server_timestamp)
-- ============================================================

-- ============================================================
-- 1. ENUM: Tipo de Atendimento (CFM)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.attendance_type AS ENUM (
    'consulta',           -- Consulta inicial
    'retorno',            -- Retorno/Revisão
    'urgencia',           -- Urgência
    'emergencia',         -- Emergência
    'procedimento',       -- Procedimento ambulatorial
    'exame',              -- Realização de exame
    'teleconsulta',       -- Teleconsulta
    'domiciliar',         -- Atendimento domiciliar
    'preventivo',         -- Consulta preventiva
    'pre_operatorio',     -- Avaliação pré-operatória
    'pos_operatorio',     -- Acompanhamento pós-operatório
    'outro'               -- Outro tipo
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.attendance_type IS 'Tipos de atendimento conforme padrões CFM';

-- ============================================================
-- 2. SEQUENCE: Número de Atendimento por Tenant
-- ============================================================

-- Tabela para controlar sequências por tenant
CREATE TABLE IF NOT EXISTS public.tenant_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  attendance_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_sequences_select" ON public.tenant_sequences
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_sequences_update" ON public.tenant_sequences
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

COMMENT ON TABLE public.tenant_sequences IS 'Controle de sequências numéricas por tenant';
COMMENT ON COLUMN public.tenant_sequences.attendance_seq IS 'Último número de atendimento gerado';

-- Função para obter próximo número de atendimento
CREATE OR REPLACE FUNCTION public.next_attendance_number(p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.tenant_sequences (tenant_id, attendance_seq)
  VALUES (p_tenant_id, 1)
  ON CONFLICT (tenant_id) DO UPDATE
  SET attendance_seq = public.tenant_sequences.attendance_seq + 1,
      updated_at = NOW()
  RETURNING attendance_seq INTO v_next;
  
  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.next_attendance_number IS 'Gera próximo número sequencial de atendimento para o tenant';

-- ============================================================
-- 3. CAMPOS CFM em medical_records
-- ============================================================
DO $$ BEGIN
  -- UF do profissional que assinou
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_records' 
    AND column_name = 'signed_by_uf'
  ) THEN
    ALTER TABLE public.medical_records ADD COLUMN signed_by_uf TEXT;
  END IF;

  -- Número sequencial de atendimento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_records' 
    AND column_name = 'attendance_number'
  ) THEN
    ALTER TABLE public.medical_records ADD COLUMN attendance_number BIGINT;
  END IF;

  -- Tipo de atendimento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_records' 
    AND column_name = 'attendance_type'
  ) THEN
    ALTER TABLE public.medical_records ADD COLUMN attendance_type public.attendance_type DEFAULT 'consulta';
  END IF;

  -- Carimbo de tempo do servidor (imutável)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_records' 
    AND column_name = 'server_timestamp'
  ) THEN
    ALTER TABLE public.medical_records ADD COLUMN server_timestamp TIMESTAMPTZ;
  END IF;
END $$;

-- Índice para busca por número de atendimento
CREATE INDEX IF NOT EXISTS idx_medical_records_attendance_number 
  ON public.medical_records(tenant_id, attendance_number);

-- Comentários
COMMENT ON COLUMN public.medical_records.signed_by_uf IS 'UF do conselho do profissional (ex: SP, RJ) - CFM 1.821/2007';
COMMENT ON COLUMN public.medical_records.attendance_number IS 'Número sequencial de atendimento por tenant - CFM 1.821/2007';
COMMENT ON COLUMN public.medical_records.attendance_type IS 'Tipo de atendimento (consulta, retorno, urgência, etc.)';
COMMENT ON COLUMN public.medical_records.server_timestamp IS 'Carimbo de tempo do servidor (imutável) - CFM 1.821/2007';

-- ============================================================
-- 4. CAMPOS CFM em medical_certificates
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'signed_by_uf'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN signed_by_uf TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'medical_certificates' 
    AND column_name = 'server_timestamp'
  ) THEN
    ALTER TABLE public.medical_certificates ADD COLUMN server_timestamp TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.medical_certificates.signed_by_uf IS 'UF do conselho do profissional - CFM 1.821/2007';
COMMENT ON COLUMN public.medical_certificates.server_timestamp IS 'Carimbo de tempo do servidor (imutável)';

-- ============================================================
-- 5. CAMPOS CFM em clinical_evolutions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clinical_evolutions' 
    AND column_name = 'signed_by_uf'
  ) THEN
    ALTER TABLE public.clinical_evolutions ADD COLUMN signed_by_uf TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clinical_evolutions' 
    AND column_name = 'server_timestamp'
  ) THEN
    ALTER TABLE public.clinical_evolutions ADD COLUMN server_timestamp TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.clinical_evolutions.signed_by_uf IS 'UF do conselho do profissional - CFM 1.821/2007';
COMMENT ON COLUMN public.clinical_evolutions.server_timestamp IS 'Carimbo de tempo do servidor (imutável)';

-- ============================================================
-- 6. CAMPOS CFM em prescriptions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'signed_by_uf'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN signed_by_uf TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'signed_by_name'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN signed_by_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'signed_by_crm'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN signed_by_crm TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prescriptions' 
    AND column_name = 'server_timestamp'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN server_timestamp TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.prescriptions.signed_by_uf IS 'UF do conselho do profissional - CFM 1.821/2007';
COMMENT ON COLUMN public.prescriptions.signed_by_name IS 'Nome do profissional que prescreveu';
COMMENT ON COLUMN public.prescriptions.signed_by_crm IS 'CRM/CRO do profissional';
COMMENT ON COLUMN public.prescriptions.server_timestamp IS 'Carimbo de tempo do servidor (imutável)';

-- ============================================================
-- 7. TRIGGER: Server Timestamp Automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_server_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.server_timestamp IS NULL THEN
    NEW.server_timestamp := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para medical_records
DROP TRIGGER IF EXISTS trg_medical_records_server_timestamp ON public.medical_records;
CREATE TRIGGER trg_medical_records_server_timestamp
  BEFORE INSERT ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();

-- Trigger para medical_certificates
DROP TRIGGER IF EXISTS trg_medical_certificates_server_timestamp ON public.medical_certificates;
CREATE TRIGGER trg_medical_certificates_server_timestamp
  BEFORE INSERT ON public.medical_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();

-- Trigger para clinical_evolutions
DROP TRIGGER IF EXISTS trg_clinical_evolutions_server_timestamp ON public.clinical_evolutions;
CREATE TRIGGER trg_clinical_evolutions_server_timestamp
  BEFORE INSERT ON public.clinical_evolutions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();

-- Trigger para prescriptions
DROP TRIGGER IF EXISTS trg_prescriptions_server_timestamp ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_server_timestamp
  BEFORE INSERT ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();

-- ============================================================
-- 8. TRIGGER: Número de Atendimento Automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_attendance_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attendance_number IS NULL THEN
    NEW.attendance_number := public.next_attendance_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_records_attendance_number ON public.medical_records;
CREATE TRIGGER trg_medical_records_attendance_number
  BEFORE INSERT ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attendance_number();

-- ============================================================
-- 9. ATUALIZAR RPC sign_medical_certificate para incluir UF
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_medical_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_cert RECORD;
  v_profile RECORD;
  v_content_hash TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  v_tenant_id := public.get_user_tenant_id(v_user_id);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant não encontrado');
  END IF;

  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não encontrado');
  END IF;

  IF v_cert.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado já foi assinado');
  END IF;

  SELECT full_name, council_number as crm, council_state as uf, 
         CASE 
           WHEN professional_type = 'medico' THEN 'Médico(a)'
           WHEN professional_type = 'dentista' THEN 'Cirurgião(ã)-Dentista'
           WHEN professional_type = 'enfermeiro' THEN 'Enfermeiro(a)'
           WHEN professional_type = 'fisioterapeuta' THEN 'Fisioterapeuta'
           WHEN professional_type = 'nutricionista' THEN 'Nutricionista'
           WHEN professional_type = 'psicologo' THEN 'Psicólogo(a)'
           WHEN professional_type = 'fonoaudiologo' THEN 'Fonoaudiólogo(a)'
           ELSE professional_type::text
         END as specialty
  INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile.crm IS NULL OR v_profile.crm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional sem número de conselho cadastrado');
  END IF;

  v_content_hash := public.generate_certificate_hash(p_certificate_id);

  UPDATE public.medical_certificates
  SET 
    digital_signature = v_content_hash,
    content_hash = v_content_hash,
    signed_at = NOW(),
    signed_by_name = v_profile.full_name,
    signed_by_crm = v_profile.crm,
    signed_by_uf = v_profile.uf,
    signed_by_specialty = v_profile.specialty,
    server_timestamp = COALESCE(server_timestamp, NOW()),
    updated_at = NOW()
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object(
    'success', true,
    'hash', v_content_hash,
    'signed_at', NOW(),
    'signed_by', v_profile.full_name,
    'crm', v_profile.crm,
    'uf', v_profile.uf
  );
END;
$$;

-- ============================================================
-- 10. ATUALIZAR RPC verify_certificate_signature para incluir UF
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_certificate_signature(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_cert RECORD;
  v_current_hash TEXT;
  v_is_valid BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  v_tenant_id := public.get_user_tenant_id(v_user_id);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant não encontrado');
  END IF;

  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não encontrado');
  END IF;

  IF v_cert.signed_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não foi assinado');
  END IF;

  v_current_hash := public.generate_certificate_hash(p_certificate_id);
  v_is_valid := (v_current_hash = v_cert.content_hash);

  RETURN jsonb_build_object(
    'success', true,
    'is_valid', v_is_valid,
    'original_hash', v_cert.content_hash,
    'current_hash', v_current_hash,
    'signed_at', v_cert.signed_at,
    'signed_by', v_cert.signed_by_name,
    'crm', v_cert.signed_by_crm,
    'uf', v_cert.signed_by_uf,
    'specialty', v_cert.signed_by_specialty,
    'server_timestamp', v_cert.server_timestamp
  );
END;
$$;

-- ============================================================
-- 11. VIEW: Resumo de Conformidade CFM
-- ============================================================
CREATE OR REPLACE VIEW public.cfm_compliance_summary AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id) as total_records,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.signed_at IS NOT NULL) as signed_records,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.signed_by_uf IS NOT NULL) as records_with_uf,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.attendance_number IS NOT NULL) as records_with_attendance_number,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.server_timestamp IS NOT NULL) as records_with_server_timestamp,
  (SELECT COUNT(*) FROM public.medical_certificates mc WHERE mc.tenant_id = t.id) as total_certificates,
  (SELECT COUNT(*) FROM public.medical_certificates mc WHERE mc.tenant_id = t.id AND mc.signed_at IS NOT NULL) as signed_certificates
FROM public.tenants t;

COMMENT ON VIEW public.cfm_compliance_summary IS 'Resumo de conformidade CFM por tenant';

-- ============================================================
-- 12. GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.next_attendance_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_server_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_attendance_number() TO authenticated;
GRANT SELECT ON public.cfm_compliance_summary TO authenticated;
