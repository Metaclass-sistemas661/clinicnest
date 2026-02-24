-- ============================================================================
-- FASE 23: Política de Retenção CFM (20 anos)
-- Resolução CFM 1.821/2007 — Guarda de prontuários por 20 anos após último atendimento
-- ============================================================================

-- ─── 23.1 Campo retention_years em tenants ────────────────────────────────────

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS retention_years INTEGER NOT NULL DEFAULT 20;

COMMENT ON COLUMN tenants.retention_years IS 
  'Período de retenção de prontuários em anos (CFM 1.821/2007 exige mínimo 20 anos)';

-- ─── 23.2 Campo last_appointment_date em clients ──────────────────────────────

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS last_appointment_date DATE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS retention_expires_at DATE;

COMMENT ON COLUMN clients.last_appointment_date IS 
  'Data do último atendimento do paciente (atualizado automaticamente)';

COMMENT ON COLUMN clients.retention_expires_at IS 
  'Data em que os dados do paciente podem ser arquivados (last_appointment_date + retention_years)';

-- Índice para consultas de expiração
CREATE INDEX IF NOT EXISTS idx_clients_retention_expires 
ON clients(tenant_id, retention_expires_at) 
WHERE retention_expires_at IS NOT NULL;

-- ─── 23.2/23.3 Trigger para atualizar last_appointment_date e retention_expires_at ───

CREATE OR REPLACE FUNCTION update_client_last_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_retention_years INTEGER;
BEGIN
  -- Só atualiza se o appointment foi completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Busca o período de retenção do tenant
    SELECT COALESCE(retention_years, 20) INTO v_retention_years
    FROM tenants WHERE id = NEW.tenant_id;
    
    -- Atualiza o cliente
    UPDATE clients
    SET 
      last_appointment_date = NEW.date,
      retention_expires_at = NEW.date + (v_retention_years || ' years')::INTERVAL,
      updated_at = NOW()
    WHERE id = NEW.client_id
      AND (last_appointment_date IS NULL OR last_appointment_date < NEW.date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trg_update_client_last_appointment ON appointments;

-- Cria trigger
CREATE TRIGGER trg_update_client_last_appointment
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_appointment();

-- ─── Atualizar dados existentes ───────────────────────────────────────────────

-- Atualiza last_appointment_date para clientes existentes
UPDATE clients c
SET 
  last_appointment_date = sub.max_date,
  retention_expires_at = sub.max_date + (COALESCE(t.retention_years, 20) || ' years')::INTERVAL
FROM (
  SELECT client_id, MAX(scheduled_at::DATE) as max_date, tenant_id
  FROM appointments
  WHERE status = 'completed'
  GROUP BY client_id, tenant_id
) sub
JOIN tenants t ON t.id = sub.tenant_id
WHERE c.id = sub.client_id
  AND (c.last_appointment_date IS NULL OR c.last_appointment_date < sub.max_date);

-- ─── 23.4 Bloqueio de exclusão antes do prazo (CRÍTICO) ───────────────────────

-- Tabela de log de tentativas de exclusão bloqueadas
CREATE TABLE IF NOT EXISTS retention_deletion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  retention_expires_at DATE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT
);

CREATE INDEX idx_retention_deletion_attempts_tenant 
ON retention_deletion_attempts(tenant_id, attempted_at DESC);

ALTER TABLE retention_deletion_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retention_deletion_attempts_tenant_isolation" 
ON retention_deletion_attempts FOR ALL 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─── Função para verificar se pode excluir ────────────────────────────────────

CREATE OR REPLACE FUNCTION check_retention_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
  v_retention_expires DATE;
  v_tenant_id UUID;
BEGIN
  -- Determina o client_id baseado na tabela
  IF TG_TABLE_NAME = 'clients' THEN
    v_client_id := OLD.id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'medical_records' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'prescriptions' THEN
    SELECT client_id, tenant_id INTO v_client_id, v_tenant_id
    FROM medical_records WHERE id = OLD.medical_record_id;
  ELSIF TG_TABLE_NAME = 'triage_records' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'clinical_evolutions' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'nursing_evolutions' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSE
    -- Tabela não protegida, permite exclusão
    RETURN OLD;
  END IF;
  
  -- Busca dados do cliente
  SELECT name, retention_expires_at 
  INTO v_client_name, v_retention_expires
  FROM clients WHERE id = v_client_id;
  
  -- Se não tem data de expiração, usa data atual + 20 anos (conservador)
  IF v_retention_expires IS NULL THEN
    v_retention_expires := CURRENT_DATE + INTERVAL '20 years';
  END IF;
  
  -- Verifica se ainda está no período de retenção
  IF v_retention_expires > CURRENT_DATE THEN
    -- Registra a tentativa bloqueada
    INSERT INTO retention_deletion_attempts (
      tenant_id, user_id, table_name, record_id, 
      client_id, client_name, retention_expires_at, reason
    ) VALUES (
      v_tenant_id, auth.uid(), TG_TABLE_NAME, OLD.id,
      v_client_id, v_client_name, v_retention_expires,
      'Tentativa de exclusão bloqueada: dados ainda no período de retenção CFM (expira em ' || 
      TO_CHAR(v_retention_expires, 'DD/MM/YYYY') || ')'
    );
    
    -- Bloqueia a exclusão
    RAISE EXCEPTION 'BLOQUEADO: Não é permitido excluir dados clínicos antes do período de retenção (CFM 1.821/2007). Este registro só pode ser excluído após %', 
      TO_CHAR(v_retention_expires, 'DD/MM/YYYY');
  END IF;
  
  -- Permite exclusão se passou do período
  RETURN OLD;
END;
$$;

-- ─── Triggers de bloqueio em tabelas clínicas ─────────────────────────────────

-- Clientes (pacientes)
DROP TRIGGER IF EXISTS trg_retention_block_clients ON clients;
CREATE TRIGGER trg_retention_block_clients
  BEFORE DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();

-- Prontuários
DROP TRIGGER IF EXISTS trg_retention_block_medical_records ON medical_records;
CREATE TRIGGER trg_retention_block_medical_records
  BEFORE DELETE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();

-- Triagens
DROP TRIGGER IF EXISTS trg_retention_block_triage_records ON triage_records;
CREATE TRIGGER trg_retention_block_triage_records
  BEFORE DELETE ON triage_records
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();

-- Evoluções clínicas (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN
    DROP TRIGGER IF EXISTS trg_retention_block_clinical_evolutions ON clinical_evolutions;
    CREATE TRIGGER trg_retention_block_clinical_evolutions
      BEFORE DELETE ON clinical_evolutions
      FOR EACH ROW
      EXECUTE FUNCTION check_retention_before_delete();
  END IF;
END $$;

-- Evoluções de enfermagem (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nursing_evolutions') THEN
    DROP TRIGGER IF EXISTS trg_retention_block_nursing_evolutions ON nursing_evolutions;
    CREATE TRIGGER trg_retention_block_nursing_evolutions
      BEFORE DELETE ON nursing_evolutions
      FOR EACH ROW
      EXECUTE FUNCTION check_retention_before_delete();
  END IF;
END $$;

-- ─── 23.5 Função para relatório de dados próximos à expiração ─────────────────

CREATE OR REPLACE FUNCTION get_clients_near_retention_expiry(
  p_tenant_id UUID,
  p_months_ahead INTEGER DEFAULT 12
) RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  cpf TEXT,
  last_appointment DATE,
  retention_expires DATE,
  days_until_expiry INTEGER,
  total_records BIGINT,
  total_prescriptions BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.cpf,
    c.last_appointment_date as last_appointment,
    c.retention_expires_at as retention_expires,
    (c.retention_expires_at - CURRENT_DATE)::INTEGER as days_until_expiry,
    (SELECT COUNT(*) FROM medical_records mr WHERE mr.client_id = c.id) as total_records,
    (SELECT COUNT(*) FROM prescriptions p 
     JOIN medical_records mr ON mr.id = p.medical_record_id 
     WHERE mr.client_id = c.id) as total_prescriptions
  FROM clients c
  WHERE c.tenant_id = p_tenant_id
    AND c.retention_expires_at IS NOT NULL
    AND c.retention_expires_at <= CURRENT_DATE + (p_months_ahead || ' months')::INTERVAL
    AND c.retention_expires_at >= CURRENT_DATE
  ORDER BY c.retention_expires_at ASC;
END;
$$;

-- ─── 23.6 Função para relatório de tentativas de exclusão ─────────────────────

CREATE OR REPLACE FUNCTION get_retention_deletion_attempts(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  attempted_at TIMESTAMPTZ,
  user_email TEXT,
  table_name TEXT,
  client_name TEXT,
  retention_expires DATE,
  reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rda.id,
    rda.attempted_at,
    COALESCE(up.email, 'Sistema') as user_email,
    rda.table_name,
    rda.client_name,
    rda.retention_expires_at as retention_expires,
    rda.reason
  FROM retention_deletion_attempts rda
  LEFT JOIN profiles up ON up.user_id = rda.user_id
  WHERE rda.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR rda.attempted_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR rda.attempted_at::DATE <= p_end_date)
  ORDER BY rda.attempted_at DESC;
END;
$$;

-- ─── 23.7 Tabela de arquivamento (cold storage) ───────────────────────────────

CREATE TABLE IF NOT EXISTS archived_clinical_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação do paciente
  client_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_cns TEXT,
  client_birth_date DATE,
  
  -- Dados arquivados (JSON completo)
  medical_records JSONB NOT NULL DEFAULT '[]',
  prescriptions JSONB NOT NULL DEFAULT '[]',
  triages JSONB NOT NULL DEFAULT '[]',
  evolutions JSONB NOT NULL DEFAULT '[]',
  attachments JSONB NOT NULL DEFAULT '[]',
  
  -- Metadados
  last_appointment_date DATE NOT NULL,
  retention_expired_at DATE NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id),
  
  -- Exportação
  export_pdf_url TEXT,
  export_xml_url TEXT,
  export_generated_at TIMESTAMPTZ,
  
  -- Hash de integridade
  data_hash TEXT NOT NULL,
  
  -- Controle
  can_be_deleted_after DATE, -- 5 anos após arquivamento (opcional)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_archived_clinical_data_tenant 
ON archived_clinical_data(tenant_id);

CREATE INDEX idx_archived_clinical_data_client 
ON archived_clinical_data(tenant_id, client_cpf);

ALTER TABLE archived_clinical_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archived_clinical_data_tenant_isolation" 
ON archived_clinical_data FOR ALL 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─── 23.7/23.8 Função para arquivar dados de um cliente ───────────────────────

CREATE OR REPLACE FUNCTION archive_client_clinical_data(
  p_client_id UUID,
  p_export_pdf_url TEXT DEFAULT NULL,
  p_export_xml_url TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client RECORD;
  v_medical_records JSONB;
  v_prescriptions JSONB;
  v_triages JSONB;
  v_evolutions JSONB;
  v_archive_id UUID;
  v_data_hash TEXT;
  v_all_data JSONB;
BEGIN
  -- Busca dados do cliente
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  
  -- Verifica se pode arquivar (período de retenção expirado)
  IF v_client.retention_expires_at IS NULL OR v_client.retention_expires_at > CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é permitido arquivar: período de retenção ainda não expirou (expira em %)',
      COALESCE(TO_CHAR(v_client.retention_expires_at, 'DD/MM/YYYY'), 'data não definida');
  END IF;
  
  -- Coleta prontuários
  SELECT COALESCE(jsonb_agg(row_to_json(mr)), '[]'::JSONB)
  INTO v_medical_records
  FROM medical_records mr
  WHERE mr.client_id = p_client_id;
  
  -- Coleta prescrições
  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::JSONB)
  INTO v_prescriptions
  FROM prescriptions p
  JOIN medical_records mr ON mr.id = p.medical_record_id
  WHERE mr.client_id = p_client_id;
  
  -- Coleta triagens
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
  INTO v_triages
  FROM triage_records t
  WHERE t.client_id = p_client_id;
  
  -- Coleta evoluções (se existir)
  v_evolutions := '[]'::JSONB;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN
    EXECUTE format('
      SELECT COALESCE(jsonb_agg(row_to_json(e)), ''[]''::JSONB)
      FROM clinical_evolutions e
      WHERE e.client_id = $1
    ') INTO v_evolutions USING p_client_id;
  END IF;
  
  -- Monta JSON completo para hash
  v_all_data := jsonb_build_object(
    'client', row_to_json(v_client),
    'medical_records', v_medical_records,
    'prescriptions', v_prescriptions,
    'triages', v_triages,
    'evolutions', v_evolutions
  );
  
  -- Gera hash de integridade
  v_data_hash := encode(sha256(v_all_data::TEXT::BYTEA), 'hex');
  
  -- Insere no arquivo
  INSERT INTO archived_clinical_data (
    tenant_id, client_id, client_name, client_cpf, client_cns, client_birth_date,
    medical_records, prescriptions, triages, evolutions,
    last_appointment_date, retention_expired_at, archived_by,
    export_pdf_url, export_xml_url, export_generated_at,
    data_hash, can_be_deleted_after
  ) VALUES (
    v_client.tenant_id, p_client_id, v_client.name, v_client.cpf, v_client.cns, v_client.birth_date,
    v_medical_records, v_prescriptions, v_triages, v_evolutions,
    v_client.last_appointment_date, v_client.retention_expires_at, auth.uid(),
    p_export_pdf_url, p_export_xml_url, 
    CASE WHEN p_export_pdf_url IS NOT NULL OR p_export_xml_url IS NOT NULL THEN NOW() ELSE NULL END,
    v_data_hash, CURRENT_DATE + INTERVAL '5 years'
  ) RETURNING id INTO v_archive_id;
  
  -- Remove dados originais (agora permitido pois passou do período)
  -- Primeiro remove dependências
  DELETE FROM prescriptions WHERE medical_record_id IN (
    SELECT id FROM medical_records WHERE client_id = p_client_id
  );
  DELETE FROM triage_records WHERE client_id = p_client_id;
  
  -- Remove evoluções se existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN
    EXECUTE 'DELETE FROM clinical_evolutions WHERE client_id = $1' USING p_client_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nursing_evolutions') THEN
    EXECUTE 'DELETE FROM nursing_evolutions WHERE client_id = $1' USING p_client_id;
  END IF;
  
  -- Remove prontuários
  DELETE FROM medical_records WHERE client_id = p_client_id;
  
  -- Marca cliente como arquivado (não exclui o cadastro básico)
  UPDATE clients 
  SET 
    notes = COALESCE(notes, '') || E'\n[ARQUIVADO em ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || ' - ID: ' || v_archive_id || ']',
    updated_at = NOW()
  WHERE id = p_client_id;
  
  RETURN v_archive_id;
END;
$$;

-- ─── Função para buscar dados arquivados ──────────────────────────────────────

CREATE OR REPLACE FUNCTION get_archived_client_data(
  p_tenant_id UUID,
  p_client_cpf TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL
) RETURNS TABLE (
  archive_id UUID,
  client_name TEXT,
  client_cpf TEXT,
  last_appointment DATE,
  archived_at TIMESTAMPTZ,
  has_pdf BOOLEAN,
  has_xml BOOLEAN,
  total_records INTEGER,
  data_hash TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acd.id as archive_id,
    acd.client_name,
    acd.client_cpf,
    acd.last_appointment_date as last_appointment,
    acd.archived_at,
    acd.export_pdf_url IS NOT NULL as has_pdf,
    acd.export_xml_url IS NOT NULL as has_xml,
    jsonb_array_length(acd.medical_records)::INTEGER as total_records,
    acd.data_hash
  FROM archived_clinical_data acd
  WHERE acd.tenant_id = p_tenant_id
    AND (p_client_cpf IS NULL OR acd.client_cpf = p_client_cpf)
    AND (p_client_name IS NULL OR acd.client_name ILIKE '%' || p_client_name || '%')
  ORDER BY acd.archived_at DESC;
END;
$$;

-- ─── Estatísticas de retenção ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_retention_statistics(p_tenant_id UUID)
RETURNS TABLE (
  total_clients BIGINT,
  clients_with_retention BIGINT,
  expiring_this_year BIGINT,
  expiring_next_year BIGINT,
  already_archived BIGINT,
  deletion_attempts_blocked BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id) as total_clients,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id AND retention_expires_at IS NOT NULL) as clients_with_retention,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 
     AND retention_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 year') as expiring_this_year,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 
     AND retention_expires_at BETWEEN CURRENT_DATE + INTERVAL '1 year' AND CURRENT_DATE + INTERVAL '2 years') as expiring_next_year,
    (SELECT COUNT(*) FROM archived_clinical_data WHERE tenant_id = p_tenant_id) as already_archived,
    (SELECT COUNT(*) FROM retention_deletion_attempts WHERE tenant_id = p_tenant_id AND blocked = true) as deletion_attempts_blocked;
END;
$$;
