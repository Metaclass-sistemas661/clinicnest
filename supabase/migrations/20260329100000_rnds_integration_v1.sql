-- ============================================================================
-- FASE 34 — Integração eSUS/RNDS (Rede Nacional de Dados em Saúde)
-- ============================================================================
-- Permite envio de dados clínicos para a RNDS do Ministério da Saúde
-- Obrigatório para clínicas do SUS e UBS
-- Referência: https://rnds.saude.gov.br/
-- ============================================================================

-- ─── Campos RNDS no tenant ─────────────────────────────────────────────────────

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS rnds_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rnds_cnes VARCHAR(7),
ADD COLUMN IF NOT EXISTS rnds_uf VARCHAR(2),
ADD COLUMN IF NOT EXISTS rnds_environment VARCHAR(20) DEFAULT 'homologacao',
ADD COLUMN IF NOT EXISTS rnds_certificate_id UUID,
ADD COLUMN IF NOT EXISTS rnds_auto_send BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rnds_last_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN tenants.rnds_enabled IS 'Habilita integração com RNDS';
COMMENT ON COLUMN tenants.rnds_cnes IS 'Código CNES do estabelecimento (7 dígitos)';
COMMENT ON COLUMN tenants.rnds_uf IS 'UF do estabelecimento (2 letras)';
COMMENT ON COLUMN tenants.rnds_environment IS 'Ambiente: homologacao ou producao';
COMMENT ON COLUMN tenants.rnds_certificate_id IS 'ID do certificado ICP-Brasil armazenado';
COMMENT ON COLUMN tenants.rnds_auto_send IS 'Enviar automaticamente após consulta concluída';
COMMENT ON COLUMN tenants.rnds_last_sync_at IS 'Última sincronização com RNDS';

-- ─── Tabela de certificados ICP-Brasil ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rnds_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject_cn VARCHAR(255),
  subject_cpf VARCHAR(11),
  subject_cnpj VARCHAR(14),
  issuer VARCHAR(255),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,
  certificate_data TEXT NOT NULL,
  password_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnds_certificates_tenant ON rnds_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnds_certificates_active ON rnds_certificates(tenant_id, is_active) WHERE is_active = TRUE;

COMMENT ON TABLE rnds_certificates IS 'Certificados ICP-Brasil A1 para autenticação RNDS';

-- ─── Enum para status de envio ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE rnds_submission_status AS ENUM (
    'pending',
    'processing',
    'success',
    'error',
    'retry'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Enum para tipo de recurso RNDS ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE rnds_resource_type AS ENUM (
    'contato_assistencial',
    'resultado_exame',
    'imunizacao',
    'atestado_digital',
    'prescricao_digital'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tabela de submissões RNDS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rnds_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  resource_type rnds_resource_type NOT NULL,
  resource_id UUID NOT NULL,
  
  patient_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  
  fhir_bundle JSONB NOT NULL,
  
  status rnds_submission_status DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  rnds_protocol VARCHAR(100),
  rnds_response JSONB,
  error_message TEXT,
  error_code VARCHAR(50),
  
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_rnds_submissions_tenant ON rnds_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_status ON rnds_submissions(status);
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_pending ON rnds_submissions(tenant_id, status, scheduled_at) 
  WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_patient ON rnds_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_appointment ON rnds_submissions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_resource ON rnds_submissions(resource_type, resource_id);

COMMENT ON TABLE rnds_submissions IS 'Histórico de envios para RNDS com status e retry';

-- ─── Tabela de tokens OAuth2 RNDS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rnds_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnds_tokens_tenant ON rnds_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnds_tokens_expires ON rnds_tokens(tenant_id, expires_at);

COMMENT ON TABLE rnds_tokens IS 'Tokens OAuth2 para autenticação na RNDS';

-- ─── Campos CNS nos clientes ───────────────────────────────────────────────────

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cns VARCHAR(15);

CREATE INDEX IF NOT EXISTS idx_clients_cns ON clients(cns) WHERE cns IS NOT NULL;

COMMENT ON COLUMN clients.cns IS 'Cartão Nacional de Saúde (CNS) - 15 dígitos';

-- ─── Campos CNS e CBO nos profissionais (tabela profiles) ──────────────────────

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS cns VARCHAR(15),
ADD COLUMN IF NOT EXISTS cbo VARCHAR(6);

CREATE INDEX IF NOT EXISTS idx_profiles_cns ON profiles(cns) WHERE cns IS NOT NULL;

COMMENT ON COLUMN profiles.cns IS 'CNS do profissional de saúde';
COMMENT ON COLUMN profiles.cbo IS 'Código CBO (Classificação Brasileira de Ocupações)';

-- ─── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE rnds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnds_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnds_tokens ENABLE ROW LEVEL SECURITY;

-- Certificates
DROP POLICY IF EXISTS rnds_certificates_tenant_isolation ON rnds_certificates;
CREATE POLICY rnds_certificates_tenant_isolation ON rnds_certificates
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Submissions
DROP POLICY IF EXISTS rnds_submissions_tenant_isolation ON rnds_submissions;
CREATE POLICY rnds_submissions_tenant_isolation ON rnds_submissions
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Tokens
DROP POLICY IF EXISTS rnds_tokens_tenant_isolation ON rnds_tokens;
CREATE POLICY rnds_tokens_tenant_isolation ON rnds_tokens
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── RPC: Obter configuração RNDS do tenant ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tenant_rnds_config()
RETURNS TABLE (
  rnds_enabled BOOLEAN,
  rnds_cnes VARCHAR,
  rnds_uf VARCHAR,
  rnds_environment VARCHAR,
  rnds_auto_send BOOLEAN,
  rnds_last_sync_at TIMESTAMPTZ,
  has_certificate BOOLEAN,
  certificate_valid_to TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  RETURN QUERY
  SELECT 
    t.rnds_enabled,
    t.rnds_cnes,
    t.rnds_uf,
    t.rnds_environment,
    t.rnds_auto_send,
    t.rnds_last_sync_at,
    EXISTS(SELECT 1 FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE) AS has_certificate,
    (SELECT c.valid_to FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE ORDER BY c.valid_to DESC LIMIT 1) AS certificate_valid_to
  FROM tenants t
  WHERE t.id = v_tenant_id;
END;
$$;

-- ─── RPC: Atualizar configuração RNDS ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_tenant_rnds_config(
  p_rnds_enabled BOOLEAN DEFAULT NULL,
  p_rnds_cnes VARCHAR DEFAULT NULL,
  p_rnds_uf VARCHAR DEFAULT NULL,
  p_rnds_environment VARCHAR DEFAULT NULL,
  p_rnds_auto_send BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  UPDATE tenants SET
    rnds_enabled = COALESCE(p_rnds_enabled, rnds_enabled),
    rnds_cnes = COALESCE(p_rnds_cnes, rnds_cnes),
    rnds_uf = COALESCE(p_rnds_uf, rnds_uf),
    rnds_environment = COALESCE(p_rnds_environment, rnds_environment),
    rnds_auto_send = COALESCE(p_rnds_auto_send, rnds_auto_send),
    updated_at = NOW()
  WHERE id = v_tenant_id;
  
  RETURN TRUE;
END;
$$;

-- ─── RPC: Criar submissão RNDS ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_rnds_submission(
  p_resource_type rnds_resource_type,
  p_resource_id UUID,
  p_fhir_bundle JSONB,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_medical_record_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_submission_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  INSERT INTO rnds_submissions (
    tenant_id,
    resource_type,
    resource_id,
    fhir_bundle,
    patient_id,
    appointment_id,
    medical_record_id,
    created_by
  ) VALUES (
    v_tenant_id,
    p_resource_type,
    p_resource_id,
    p_fhir_bundle,
    p_patient_id,
    p_appointment_id,
    p_medical_record_id,
    auth.uid()
  )
  RETURNING id INTO v_submission_id;
  
  RETURN v_submission_id;
END;
$$;

-- ─── RPC: Listar submissões pendentes ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pending_rnds_submissions(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  resource_type rnds_resource_type,
  resource_id UUID,
  fhir_bundle JSONB,
  attempt_count INTEGER,
  scheduled_at TIMESTAMPTZ,
  rnds_cnes VARCHAR,
  rnds_uf VARCHAR,
  rnds_environment VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tenant_id,
    s.resource_type,
    s.resource_id,
    s.fhir_bundle,
    s.attempt_count,
    s.scheduled_at,
    t.rnds_cnes,
    t.rnds_uf,
    t.rnds_environment
  FROM rnds_submissions s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.status IN ('pending', 'retry')
    AND s.scheduled_at <= NOW()
    AND (s.next_retry_at IS NULL OR s.next_retry_at <= NOW())
    AND s.attempt_count < s.max_attempts
    AND t.rnds_enabled = TRUE
  ORDER BY s.scheduled_at ASC
  LIMIT p_limit;
END;
$$;

-- ─── RPC: Atualizar status da submissão ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_rnds_submission_status(
  p_submission_id UUID,
  p_status rnds_submission_status,
  p_rnds_protocol VARCHAR DEFAULT NULL,
  p_rnds_response JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_retry TIMESTAMPTZ;
  v_attempt INTEGER;
BEGIN
  SELECT attempt_count INTO v_attempt FROM rnds_submissions WHERE id = p_submission_id;
  
  IF p_status = 'retry' THEN
    v_next_retry := NOW() + (POWER(2, v_attempt) * INTERVAL '1 minute');
  END IF;
  
  UPDATE rnds_submissions SET
    status = p_status,
    rnds_protocol = COALESCE(p_rnds_protocol, rnds_protocol),
    rnds_response = COALESCE(p_rnds_response, rnds_response),
    error_message = p_error_message,
    error_code = p_error_code,
    attempt_count = attempt_count + 1,
    processed_at = CASE WHEN p_status IN ('success', 'error') THEN NOW() ELSE processed_at END,
    next_retry_at = v_next_retry,
    updated_at = NOW()
  WHERE id = p_submission_id;
  
  IF p_status = 'success' THEN
    UPDATE tenants SET rnds_last_sync_at = NOW()
    WHERE id = (SELECT tenant_id FROM rnds_submissions WHERE id = p_submission_id);
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ─── RPC: Estatísticas RNDS do tenant ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_rnds_statistics()
RETURNS TABLE (
  total_submissions BIGINT,
  pending_count BIGINT,
  success_count BIGINT,
  error_count BIGINT,
  retry_count BIGINT,
  success_rate NUMERIC,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_submissions,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_count,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS success_count,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT AS error_count,
    COUNT(*) FILTER (WHERE status = 'retry')::BIGINT AS retry_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status IN ('success', 'error')) > 0 
      THEN ROUND(
        COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
        COUNT(*) FILTER (WHERE status IN ('success', 'error'))::NUMERIC * 100, 2
      )
      ELSE 0
    END AS success_rate,
    MAX(processed_at) FILTER (WHERE status = 'success') AS last_success_at,
    MAX(processed_at) FILTER (WHERE status = 'error') AS last_error_at
  FROM rnds_submissions
  WHERE tenant_id = v_tenant_id;
END;
$$;

-- ─── RPC: Consultar CNS por CPF (mock - em produção usa API RNDS) ──────────────

CREATE OR REPLACE FUNCTION lookup_cns_by_cpf(p_cpf VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT cns FROM clients 
    WHERE cpf = p_cpf AND cns IS NOT NULL
    LIMIT 1
  );
END;
$$;

-- ─── Trigger: Auto-envio após consulta concluída ───────────────────────────────

CREATE OR REPLACE FUNCTION auto_submit_to_rnds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_record RECORD;
  v_patient RECORD;
  v_professional RECORD;
  v_fhir_bundle JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_tenant_record FROM tenants WHERE id = NEW.tenant_id;
    
    IF v_tenant_record.rnds_enabled = TRUE AND v_tenant_record.rnds_auto_send = TRUE THEN
      SELECT * INTO v_patient FROM clients WHERE id = NEW.client_id;
      SELECT * INTO v_professional FROM profiles WHERE id = NEW.professional_id;
      
      IF v_patient.cns IS NOT NULL OR v_patient.cpf IS NOT NULL THEN
        v_fhir_bundle := jsonb_build_object(
          'resourceType', 'Bundle',
          'type', 'transaction',
          'timestamp', NOW(),
          'appointment_id', NEW.id,
          'patient', jsonb_build_object(
            'id', v_patient.id,
            'name', v_patient.name,
            'cpf', v_patient.cpf,
            'cns', v_patient.cns,
            'birth_date', v_patient.birth_date,
            'gender', v_patient.gender
          ),
          'encounter', jsonb_build_object(
            'date', NEW.date,
            'type', NEW.service_type,
            'professional_name', v_professional.full_name,
            'professional_crm', v_professional.crm,
            'professional_cbo', v_professional.cbo,
            'cnes', v_tenant_record.rnds_cnes
          )
        );
        
        INSERT INTO rnds_submissions (
          tenant_id,
          resource_type,
          resource_id,
          fhir_bundle,
          patient_id,
          appointment_id,
          status
        ) VALUES (
          NEW.tenant_id,
          'contato_assistencial',
          NEW.id,
          v_fhir_bundle,
          NEW.client_id,
          NEW.id,
          'pending'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_submit_rnds ON appointments;
CREATE TRIGGER trg_auto_submit_rnds
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_submit_to_rnds();

-- ─── Grants ────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_tenant_rnds_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_rnds_config(BOOLEAN, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION create_rnds_submission(rnds_resource_type, UUID, JSONB, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_rnds_submissions(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_rnds_submission_status(UUID, rnds_submission_status, VARCHAR, JSONB, TEXT, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_rnds_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_cns_by_cpf(VARCHAR) TO authenticated;
