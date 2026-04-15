-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (007_compliance)
-- 17 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260324400000_backup_logs_sbis_v1.sql
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
  verified_by UUID,
  
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

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Source: 20260324400000_backup_logs_sbis_v1.sql
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

ALTER TABLE public.backup_retention_policies ENABLE ROW LEVEL SECURITY;

-- Source: 20260324400000_backup_logs_sbis_v1.sql
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
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.backup_verifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TABLE IF NOT EXISTS dpo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Dados do DPO
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf TEXT,
  
  -- Qualificação
  formacao TEXT,
  certificacoes TEXT[],
  
  -- Publicação (LGPD Art. 41)
  publicado BOOLEAN DEFAULT false,
  url_publicacao TEXT,
  data_nomeacao DATE,
  
  -- Contato público
  email_publico TEXT,
  telefone_publico TEXT,
  
  -- Metadados
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.dpo_config ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TABLE IF NOT EXISTS lgpd_consentimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Titular
  titular_id UUID, -- pode ser client_id
  titular_email TEXT NOT NULL,
  titular_nome TEXT,
  
  -- Consentimento
  finalidade TEXT NOT NULL,
  descricao TEXT,
  dados_coletados TEXT[],
  
  -- Status
  consentido BOOLEAN NOT NULL,
  data_consentimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_revogacao TIMESTAMPTZ,
  
  -- Evidência
  ip_address TEXT,
  user_agent TEXT,
  metodo TEXT CHECK (metodo IN ('checkbox', 'assinatura', 'verbal', 'documento')),
  evidencia_url TEXT,
  
  -- Validade
  validade_dias INTEGER,
  data_expiracao TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lgpd_consentimentos ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TABLE IF NOT EXISTS lgpd_incidentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  
  -- Classificação
  tipo TEXT NOT NULL CHECK (tipo IN (
    'vazamento_dados',
    'acesso_nao_autorizado',
    'perda_dados',
    'alteracao_indevida',
    'indisponibilidade',
    'ransomware',
    'phishing',
    'outro'
  )),
  severidade TEXT NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  
  -- Dados afetados
  dados_afetados TEXT[],
  categorias_dados TEXT[], -- pessoais, sensíveis, financeiros
  quantidade_titulares_afetados INTEGER,
  titulares_identificados BOOLEAN DEFAULT false,
  
  -- Timeline
  data_ocorrencia TIMESTAMPTZ,
  data_deteccao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_contencao TIMESTAMPTZ,
  data_resolucao TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'detectado' CHECK (status IN (
    'detectado',
    'em_investigacao',
    'contido',
    'em_remediacao',
    'resolvido',
    'encerrado'
  )),
  
  -- Notificação ANPD (Art. 48)
  requer_notificacao_anpd BOOLEAN DEFAULT false,
  notificacao_anpd_enviada BOOLEAN DEFAULT false,
  data_notificacao_anpd TIMESTAMPTZ,
  protocolo_anpd TEXT,
  prazo_notificacao TIMESTAMPTZ, -- 72 horas após conhecimento
  
  -- Notificação aos titulares
  requer_notificacao_titulares BOOLEAN DEFAULT false,
  notificacao_titulares_enviada BOOLEAN DEFAULT false,
  data_notificacao_titulares TIMESTAMPTZ,
  
  -- Medidas tomadas
  medidas_contencao TEXT[],
  medidas_remediacao TEXT[],
  medidas_preventivas TEXT[],
  
  -- Responsáveis
  responsavel_investigacao UUID,
  responsavel_comunicacao UUID,
  
  -- Documentação
  evidencias JSONB DEFAULT '[]',
  timeline_acoes JSONB DEFAULT '[]',
  post_mortem TEXT,
  licoes_aprendidas TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lgpd_incidentes ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação do titular
  titular_nome TEXT NOT NULL,
  titular_email TEXT NOT NULL,
  titular_cpf TEXT,
  titular_telefone TEXT,
  
  -- Tipo de solicitação (Art. 18)
  tipo TEXT NOT NULL CHECK (tipo IN (
    'confirmacao_tratamento',    -- I - confirmação da existência de tratamento
    'acesso_dados',              -- II - acesso aos dados
    'correcao',                  -- III - correção de dados incompletos/inexatos
    'anonimizacao',              -- IV - anonimização, bloqueio ou eliminação
    'portabilidade',             -- V - portabilidade dos dados
    'eliminacao',                -- VI - eliminação dos dados
    'informacao_compartilhamento', -- VII - informação sobre compartilhamento
    'revogacao_consentimento',   -- IX - revogação do consentimento
    'oposicao'                   -- § 2º - oposição ao tratamento
  )),
  
  -- Detalhes
  descricao TEXT,
  dados_solicitados TEXT[],
  
  -- Status e prazos
  status TEXT NOT NULL DEFAULT 'recebida' CHECK (status IN (
    'recebida',
    'em_analise',
    'aguardando_informacoes',
    'em_atendimento',
    'concluida',
    'negada',
    'cancelada'
  )),
  
  -- Prazos LGPD
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prazo_resposta TIMESTAMPTZ, -- 15 dias (Art. 18 § 3º)
  data_resposta TIMESTAMPTZ,
  
  -- Resposta
  resposta TEXT,
  motivo_negativa TEXT,
  arquivos_resposta TEXT[],
  
  -- Responsável
  atendido_por UUID,
  
  -- Auditoria
  historico JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE TABLE IF NOT EXISTS override_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('feature', 'limit')),
  override_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'expired')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.override_audit_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TABLE IF NOT EXISTS retention_deletion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_id UUID REFERENCES public.patients(id),
  client_name TEXT,
  retention_expires_at DATE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT
);

ALTER TABLE public.retention_deletion_attempts ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
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
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  -- Revisão
  next_review_at DATE,
  review_notes TEXT,
  
  -- Arquivo PDF
  pdf_url TEXT,
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ripd_reports ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
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
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sbis_documentation ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TABLE IF NOT EXISTS sngpc_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Configuração
  ativo BOOLEAN DEFAULT true,
  frequencia VARCHAR(20) NOT NULL DEFAULT 'semanal', -- 'diario', 'semanal', 'quinzenal', 'mensal'
  dia_semana INTEGER, -- 0-6 (domingo-sábado) para semanal
  dia_mes INTEGER, -- 1-31 para mensal
  hora_execucao TIME DEFAULT '23:00',
  
  -- Última execução
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  ultima_transmissao_id UUID REFERENCES sngpc_transmissoes(id),
  
  -- Notificações
  notificar_sucesso BOOLEAN DEFAULT true,
  notificar_erro BOOLEAN DEFAULT true,
  emails_notificacao TEXT[],
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.sngpc_agendamentos ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TABLE IF NOT EXISTS sngpc_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Credenciais (devem ser criptografadas na aplicação)
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  
  -- Dados do estabelecimento
  cnpj VARCHAR(18) NOT NULL,
  razao_social VARCHAR(200),
  
  -- Responsável técnico
  cpf_responsavel VARCHAR(14) NOT NULL,
  nome_responsavel VARCHAR(200) NOT NULL,
  crf_responsavel VARCHAR(20), -- CRF do farmacêutico
  
  -- Email para notificações
  email_notificacao VARCHAR(200),
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  ultima_autenticacao TIMESTAMPTZ,
  token_expira_em TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.sngpc_credenciais ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE TABLE IF NOT EXISTS sngpc_notificacoes_receita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  tipo_receituario TEXT NOT NULL CHECK (tipo_receituario IN ('AMARELA', 'AZUL', 'BRANCA_2VIAS')),
  lista TEXT NOT NULL,
  
  -- Dados do medicamento
  medicamento_codigo TEXT NOT NULL,
  medicamento_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  posologia TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL,
  
  -- Dados do paciente
  paciente_id UUID REFERENCES public.patients(id),
  paciente_nome TEXT NOT NULL,
  paciente_endereco TEXT NOT NULL,
  paciente_cidade TEXT NOT NULL,
  paciente_uf TEXT NOT NULL,
  paciente_cpf TEXT,
  
  -- Dados do prescritor
  prescriptor_id UUID REFERENCES profiles(id),
  prescriptor_nome TEXT NOT NULL,
  prescriptor_crm TEXT NOT NULL,
  prescriptor_uf TEXT NOT NULL,
  
  -- Controle
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'DISPENSADA', 'CANCELADA', 'VENCIDA')),
  data_dispensacao DATE,
  
  -- Dados da dispensação
  movimentacao_id UUID REFERENCES sngpc_movimentacoes(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, numero, serie)
);

ALTER TABLE public.sngpc_notificacoes_receita ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE TABLE IF NOT EXISTS sngpc_sequencial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_receituario TEXT NOT NULL CHECK (tipo_receituario IN ('AMARELA', 'AZUL', 'BRANCA_2VIAS')),
  ano INTEGER NOT NULL,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, tipo_receituario, ano)
);

ALTER TABLE public.sngpc_sequencial ENABLE ROW LEVEL SECURITY;

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE TABLE IF NOT EXISTS public.sngpc_tracked_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Classificação ANVISA
  anvisa_lista TEXT NOT NULL CHECK (anvisa_lista IN (
    'A1','A2','B1','B2','C1','C2','C3','C4','C5','antimicrobiano'
  )),
  recipe_type TEXT NOT NULL, -- 'amarela', 'azul', 'branca_especial'
  
  -- Medicamento
  medication_name TEXT NOT NULL,
  medication_dosage TEXT,
  medication_quantity TEXT,
  medication_duration_days INT,
  
  -- Dispensação
  dispensed_at TIMESTAMPTZ,
  dispensed_by TEXT,
  dispensed_pharmacy TEXT,
  dispensation_status TEXT NOT NULL DEFAULT 'pendente' 
    CHECK (dispensation_status IN ('pendente','dispensado','parcial','cancelado','expirado')),
  
  -- Rastreamento SNGPC
  sngpc_notified BOOLEAN DEFAULT FALSE,
  sngpc_notification_date TIMESTAMPTZ,
  sngpc_protocol TEXT, -- Protocolo de notificação retornado

  -- Validade
  prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sngpc_tracked_prescriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TABLE IF NOT EXISTS sngpc_transmissoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmissao_id UUID NOT NULL REFERENCES sngpc_transmissoes(id) ON DELETE CASCADE,
  
  acao VARCHAR(50) NOT NULL, -- 'envio', 'consulta', 'retentativa', 'cancelamento'
  status_anterior sngpc_transmissao_status,
  status_novo sngpc_transmissao_status,
  
  -- Detalhes da tentativa
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  erro_mensagem TEXT,
  
  -- Auditoria
  executado_por UUID,
  executado_em TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

ALTER TABLE public.sngpc_transmissoes_log ENABLE ROW LEVEL SECURITY;

