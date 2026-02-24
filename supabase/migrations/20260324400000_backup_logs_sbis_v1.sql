-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║  FASE 20.1 — Logs de Backup Verificáveis (SBIS NGS2)                          ║
-- ║  Registro de backups com hash de verificação para certificação SBIS           ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝

-- ─── Tabela de Logs de Backup ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação do backup
  backup_id TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential', 'transaction_log')),
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'verified', 'corrupted')),
  
  -- Métricas
  size_bytes BIGINT,
  tables_count INTEGER,
  records_count BIGINT,
  duration_seconds INTEGER,
  
  -- Verificação de integridade (SBIS NGS2)
  checksum_algorithm TEXT DEFAULT 'SHA-256',
  checksum_value TEXT,
  verification_checksum TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  -- Localização
  storage_location TEXT,
  storage_provider TEXT CHECK (storage_provider IN ('supabase', 's3', 'azure', 'gcs', 'local')),
  retention_days INTEGER DEFAULT 365,
  expires_at TIMESTAMPTZ,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabela de Verificações de Backup ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backup_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  backup_log_id UUID NOT NULL REFERENCES backup_logs(id) ON DELETE CASCADE,
  
  -- Verificação
  verification_type TEXT NOT NULL CHECK (verification_type IN ('checksum', 'restore_test', 'integrity_check', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning')),
  
  -- Detalhes
  checksum_match BOOLEAN,
  tables_verified INTEGER,
  records_verified BIGINT,
  errors_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,
  
  -- Resultado
  details JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Auditoria
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabela de Política de Retenção ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backup_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Configuração
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential', 'transaction_log', 'all')),
  retention_days INTEGER NOT NULL DEFAULT 365,
  min_copies INTEGER DEFAULT 3,
  
  -- Agendamento
  schedule_cron TEXT, -- Ex: '0 2 * * *' para 2h da manhã diariamente
  enabled BOOLEAN DEFAULT true,
  
  -- Notificações
  notify_on_failure BOOLEAN DEFAULT true,
  notify_on_success BOOLEAN DEFAULT false,
  notification_emails TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_backup_logs_tenant ON backup_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created ON backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_type ON backup_logs(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_verifications_backup ON backup_verifications(backup_log_id);
CREATE INDEX IF NOT EXISTS idx_backup_retention_tenant ON backup_retention_policies(tenant_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────────

ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_logs_tenant_isolation" ON backup_logs
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "backup_verifications_tenant_isolation" ON backup_verifications
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "backup_retention_tenant_isolation" ON backup_retention_policies
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ─── Função para Registrar Backup ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION register_backup(
  p_tenant_id UUID,
  p_backup_id TEXT,
  p_backup_type TEXT,
  p_size_bytes BIGINT DEFAULT NULL,
  p_tables_count INTEGER DEFAULT NULL,
  p_records_count BIGINT DEFAULT NULL,
  p_storage_location TEXT DEFAULT NULL,
  p_storage_provider TEXT DEFAULT 'supabase',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_retention_days INTEGER;
BEGIN
  -- Buscar política de retenção
  SELECT retention_days INTO v_retention_days
  FROM backup_retention_policies
  WHERE tenant_id = p_tenant_id
    AND (backup_type = p_backup_type OR backup_type = 'all')
    AND enabled = true
  ORDER BY backup_type DESC
  LIMIT 1;
  
  v_retention_days := COALESCE(v_retention_days, 365);
  
  INSERT INTO backup_logs (
    tenant_id, backup_id, backup_type, started_at,
    size_bytes, tables_count, records_count,
    storage_location, storage_provider,
    retention_days, expires_at, metadata
  ) VALUES (
    p_tenant_id, p_backup_id, p_backup_type, NOW(),
    p_size_bytes, p_tables_count, p_records_count,
    p_storage_location, p_storage_provider,
    v_retention_days, NOW() + (v_retention_days || ' days')::INTERVAL, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ─── Função para Completar Backup com Hash ────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_backup(
  p_log_id UUID,
  p_checksum TEXT,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_size_bytes BIGINT DEFAULT NULL,
  p_records_count BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE backup_logs
  SET 
    status = 'completed',
    completed_at = NOW(),
    checksum_value = p_checksum,
    duration_seconds = COALESCE(p_duration_seconds, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER),
    size_bytes = COALESCE(p_size_bytes, size_bytes),
    records_count = COALESCE(p_records_count, records_count)
  WHERE id = p_log_id;
  
  RETURN FOUND;
END;
$$;

-- ─── Função para Verificar Backup ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_backup(
  p_log_id UUID,
  p_verification_checksum TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  verified BOOLEAN,
  match_result BOOLEAN,
  original_checksum TEXT,
  verification_checksum TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_checksum TEXT;
  v_match BOOLEAN;
  v_tenant_id UUID;
BEGIN
  -- Buscar checksum original
  SELECT checksum_value, tenant_id 
  INTO v_original_checksum, v_tenant_id
  FROM backup_logs
  WHERE id = p_log_id;
  
  IF v_original_checksum IS NULL THEN
    RETURN QUERY SELECT false, false, ''::TEXT, p_verification_checksum;
    RETURN;
  END IF;
  
  -- Comparar checksums
  v_match := (v_original_checksum = p_verification_checksum);
  
  -- Atualizar log
  UPDATE backup_logs
  SET 
    status = CASE WHEN v_match THEN 'verified' ELSE 'corrupted' END,
    verification_checksum = p_verification_checksum,
    verified_at = NOW(),
    verified_by = COALESCE(p_user_id, auth.uid())
  WHERE id = p_log_id;
  
  -- Registrar verificação
  INSERT INTO backup_verifications (
    tenant_id, backup_log_id, verification_type, status,
    checksum_match, performed_by
  ) VALUES (
    v_tenant_id, p_log_id, 'checksum',
    CASE WHEN v_match THEN 'passed' ELSE 'failed' END,
    v_match, COALESCE(p_user_id, auth.uid())
  );
  
  RETURN QUERY SELECT true, v_match, v_original_checksum, p_verification_checksum;
END;
$$;

-- ─── Função para Relatório de Backups (SBIS) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION get_backup_report(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_backups BIGINT,
  successful_backups BIGINT,
  failed_backups BIGINT,
  verified_backups BIGINT,
  corrupted_backups BIGINT,
  total_size_gb NUMERIC,
  avg_duration_minutes NUMERIC,
  last_backup_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  compliance_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
  v_total BIGINT;
  v_successful BIGINT;
  v_failed BIGINT;
  v_verified BIGINT;
  v_corrupted BIGINT;
  v_size NUMERIC;
  v_duration NUMERIC;
  v_last_backup TIMESTAMPTZ;
  v_last_verified TIMESTAMPTZ;
  v_compliance TEXT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'verified')),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'verified'),
    COUNT(*) FILTER (WHERE status = 'corrupted'),
    COALESCE(SUM(size_bytes) / 1073741824.0, 0),
    COALESCE(AVG(duration_seconds) / 60.0, 0),
    MAX(completed_at),
    MAX(verified_at)
  INTO v_total, v_successful, v_failed, v_verified, v_corrupted, v_size, v_duration, v_last_backup, v_last_verified
  FROM backup_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_start
    AND created_at <= v_end + INTERVAL '1 day';
  
  -- Determinar status de compliance SBIS
  IF v_corrupted > 0 THEN
    v_compliance := 'NON_COMPLIANT';
  ELSIF v_last_backup IS NULL OR v_last_backup < NOW() - INTERVAL '24 hours' THEN
    v_compliance := 'WARNING';
  ELSIF v_verified = 0 THEN
    v_compliance := 'PENDING_VERIFICATION';
  ELSIF v_failed > v_successful * 0.1 THEN
    v_compliance := 'WARNING';
  ELSE
    v_compliance := 'COMPLIANT';
  END IF;
  
  RETURN QUERY SELECT 
    v_total, v_successful, v_failed, v_verified, v_corrupted,
    v_size, v_duration, v_last_backup, v_last_verified, v_compliance;
END;
$$;

-- ─── Função para Limpar Backups Expirados ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_backups(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM backup_logs
    WHERE expires_at < NOW()
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND status IN ('completed', 'verified')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN v_deleted;
END;
$$;
