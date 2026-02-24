-- Fase 17 - Compliance e Certificações
-- Sistema de Carimbo de Tempo (TSA), Exportação de Prontuário, RIPD, SBIS, Backups

-- Enum para status do carimbo de tempo
CREATE TYPE tsa_status AS ENUM (
  'pending',      -- Aguardando carimbo
  'stamped',      -- Carimbado com sucesso
  'error',        -- Erro no carimbo
  'expired'       -- Certificado expirado
);

-- Enum para tipo de documento carimbado
CREATE TYPE tsa_document_type AS ENUM (
  'prontuario',
  'receituario',
  'atestado',
  'laudo',
  'termo_consentimento',
  'evolucao',
  'contrato',
  'outro'
);

-- Enum para provedor TSA
CREATE TYPE tsa_provider AS ENUM (
  'certisign',
  'bry',
  'valid',
  'serpro',
  'custom'
);

-- Tabela de configuração TSA por tenant
CREATE TABLE IF NOT EXISTS tsa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provedor
  provider tsa_provider NOT NULL DEFAULT 'certisign',
  
  -- Credenciais (criptografadas na aplicação)
  api_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  certificate_path TEXT,
  certificate_password_encrypted TEXT,
  
  -- Configurações
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  policy_oid VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_error TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(tenant_id)
);

-- Tabela de carimbos de tempo
CREATE TABLE IF NOT EXISTS tsa_timestamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Documento carimbado
  document_type tsa_document_type NOT NULL,
  document_id UUID NOT NULL,
  document_table VARCHAR(100) NOT NULL,
  
  -- Hash do documento original
  document_hash TEXT NOT NULL,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  
  -- Resposta TSA
  status tsa_status NOT NULL DEFAULT 'pending',
  timestamp_token BYTEA,
  timestamp_token_base64 TEXT,
  serial_number VARCHAR(100),
  
  -- Dados do carimbo
  tsa_time TIMESTAMPTZ,
  tsa_policy_oid VARCHAR(100),
  tsa_provider tsa_provider,
  tsa_response JSONB,
  
  -- Verificação
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_result JSONB,
  
  -- Erro (se houver)
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de exportações de prontuário (portabilidade)
CREATE TABLE IF NOT EXISTS prontuario_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Paciente
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name VARCHAR(200) NOT NULL,
  client_cpf VARCHAR(14),
  
  -- Conteúdo exportado
  include_prontuarios BOOLEAN DEFAULT true,
  include_receituarios BOOLEAN DEFAULT true,
  include_atestados BOOLEAN DEFAULT true,
  include_laudos BOOLEAN DEFAULT true,
  include_evolucoes BOOLEAN DEFAULT true,
  include_exames BOOLEAN DEFAULT true,
  include_anexos BOOLEAN DEFAULT true,
  
  -- Período
  data_inicio DATE,
  data_fim DATE,
  
  -- Arquivos gerados
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  xml_url TEXT,
  xml_size_bytes INTEGER,
  zip_url TEXT,
  zip_size_bytes INTEGER,
  
  -- Hash para verificação
  content_hash TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  
  -- TSA (opcional)
  tsa_timestamp_id UUID REFERENCES tsa_timestamps(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  
  -- Solicitação
  requested_by UUID REFERENCES auth.users(id),
  requested_reason TEXT,
  
  -- Download
  download_count INTEGER DEFAULT 0,
  last_download_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de RIPD (Relatório de Impacto à Proteção de Dados)
CREATE TABLE IF NOT EXISTS ripd_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  version VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT 'Relatório de Impacto à Proteção de Dados Pessoais',
  
  -- Seções do RIPD (conforme modelo ANPD)
  identificacao_agentes JSONB NOT NULL DEFAULT '{}',
  necessidade_proporcionalidade JSONB NOT NULL DEFAULT '{}',
  identificacao_riscos JSONB NOT NULL DEFAULT '{}',
  medidas_salvaguardas JSONB NOT NULL DEFAULT '{}',
  
  -- Dados tratados
  dados_pessoais_tratados JSONB DEFAULT '[]',
  bases_legais JSONB DEFAULT '[]',
  finalidades JSONB DEFAULT '[]',
  
  -- Análise de riscos
  riscos_identificados JSONB DEFAULT '[]',
  matriz_riscos JSONB DEFAULT '{}',
  
  -- Medidas de mitigação
  medidas_tecnicas JSONB DEFAULT '[]',
  medidas_administrativas JSONB DEFAULT '[]',
  
  -- Aprovação
  status VARCHAR(20) DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Revisão
  next_review_at DATE,
  review_notes TEXT,
  
  -- Arquivo PDF
  pdf_url TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de documentação SBIS
CREATE TABLE IF NOT EXISTS sbis_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Categoria NGS2
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  requirement_code VARCHAR(20),
  
  -- Documento
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  
  -- Evidências
  evidence_type VARCHAR(50),
  evidence_url TEXT,
  screenshots JSONB DEFAULT '[]',
  
  -- Status de conformidade
  compliance_status VARCHAR(20) DEFAULT 'pending',
  compliance_notes TEXT,
  
  -- Auditoria
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de logs de backup
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  backup_type VARCHAR(50) NOT NULL,
  backup_name VARCHAR(200) NOT NULL,
  
  -- Dados do backup
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Tamanho
  size_bytes BIGINT,
  compressed_size_bytes BIGINT,
  
  -- Localização
  storage_provider VARCHAR(50),
  storage_path TEXT,
  storage_region VARCHAR(50),
  
  -- Verificação de integridade
  content_hash TEXT NOT NULL,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_hash TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  
  -- Retenção
  retention_days INTEGER DEFAULT 30,
  expires_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  -- Restauração
  last_restore_test_at TIMESTAMPTZ,
  restore_test_success BOOLEAN,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_tsa_config_tenant ON tsa_config(tenant_id);
CREATE INDEX idx_tsa_timestamps_tenant ON tsa_timestamps(tenant_id);
CREATE INDEX idx_tsa_timestamps_document ON tsa_timestamps(document_type, document_id);
CREATE INDEX idx_tsa_timestamps_status ON tsa_timestamps(status);

CREATE INDEX idx_prontuario_exports_tenant ON prontuario_exports(tenant_id);
CREATE INDEX idx_prontuario_exports_client ON prontuario_exports(client_id);
CREATE INDEX idx_prontuario_exports_status ON prontuario_exports(status);

CREATE INDEX idx_ripd_reports_tenant ON ripd_reports(tenant_id);
CREATE INDEX idx_sbis_documentation_tenant ON sbis_documentation(tenant_id);
CREATE INDEX idx_sbis_documentation_category ON sbis_documentation(category);

CREATE INDEX idx_backup_logs_tenant ON backup_logs(tenant_id);
CREATE INDEX idx_backup_logs_date ON backup_logs(created_at DESC);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);

-- RLS
ALTER TABLE tsa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsa_timestamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ripd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbis_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tsa_config" ON tsa_config
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for tsa_timestamps" ON tsa_timestamps
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for prontuario_exports" ON prontuario_exports
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for ripd_reports" ON ripd_reports
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for sbis_documentation" ON sbis_documentation
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for backup_logs" ON backup_logs
  FOR ALL USING (tenant_id IS NULL OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Triggers
CREATE TRIGGER trigger_tsa_config_updated_at
  BEFORE UPDATE ON tsa_config
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

CREATE TRIGGER trigger_ripd_reports_updated_at
  BEFORE UPDATE ON ripd_reports
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

CREATE TRIGGER trigger_sbis_documentation_updated_at
  BEFORE UPDATE ON sbis_documentation
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

-- Comentários
COMMENT ON TABLE tsa_config IS 'Configuração de Carimbo de Tempo (TSA) por tenant';
COMMENT ON TABLE tsa_timestamps IS 'Carimbos de tempo aplicados em documentos';
COMMENT ON TABLE prontuario_exports IS 'Exportações de prontuário para portabilidade (LGPD)';
COMMENT ON TABLE ripd_reports IS 'Relatórios de Impacto à Proteção de Dados (LGPD)';
COMMENT ON TABLE sbis_documentation IS 'Documentação para certificação SBIS NGS2';
COMMENT ON TABLE backup_logs IS 'Logs de backup com hash de verificação';
