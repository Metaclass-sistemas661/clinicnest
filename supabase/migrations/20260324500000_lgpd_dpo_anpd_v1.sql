-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║  FASE 21.7/21.8 — Configuração DPO e Notificação ANPD                         ║
-- ║  Estrutura para gestão de privacidade e conformidade LGPD                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝

-- ─── Configuração do DPO (Encarregado de Dados) ───────────────────────────────────

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

-- ─── Solicitações de Titulares (LGPD Art. 18) ─────────────────────────────────────

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
  atendido_por UUID REFERENCES auth.users(id),
  
  -- Auditoria
  historico JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Incidentes de Segurança (para notificação ANPD) ──────────────────────────────

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
  responsavel_investigacao UUID REFERENCES auth.users(id),
  responsavel_comunicacao UUID REFERENCES auth.users(id),
  
  -- Documentação
  evidencias JSONB DEFAULT '[]',
  timeline_acoes JSONB DEFAULT '[]',
  post_mortem TEXT,
  licoes_aprendidas TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Consentimentos (registro de bases legais) ────────────────────────────────────

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

-- ─── Índices ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dpo_config_tenant ON dpo_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_tenant ON lgpd_solicitacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_status ON lgpd_solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_tipo ON lgpd_solicitacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_prazo ON lgpd_solicitacoes(prazo_resposta);
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_tenant ON lgpd_incidentes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_status ON lgpd_incidentes(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_severidade ON lgpd_incidentes(severidade);
CREATE INDEX IF NOT EXISTS idx_lgpd_consentimentos_tenant ON lgpd_consentimentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consentimentos_titular ON lgpd_consentimentos(titular_email);

-- ─── RLS ──────────────────────────────────────────────────────────────────────────

ALTER TABLE dpo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_consentimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpo_config_tenant_isolation" ON dpo_config
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "lgpd_solicitacoes_tenant_isolation" ON lgpd_solicitacoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "lgpd_incidentes_tenant_isolation" ON lgpd_incidentes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "lgpd_consentimentos_tenant_isolation" ON lgpd_consentimentos
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ─── Função para calcular prazo de resposta ───────────────────────────────────────

CREATE OR REPLACE FUNCTION calcular_prazo_lgpd()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prazo de 15 dias para resposta (Art. 18 § 3º)
  NEW.prazo_resposta := NEW.data_solicitacao + INTERVAL '15 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_prazo_lgpd
  BEFORE INSERT ON lgpd_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION calcular_prazo_lgpd();

-- ─── Função para calcular prazo de notificação ANPD ───────────────────────────────

CREATE OR REPLACE FUNCTION calcular_prazo_notificacao_anpd()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prazo de 72 horas para notificação (Art. 48 § 1º)
  IF NEW.requer_notificacao_anpd = true THEN
    NEW.prazo_notificacao := NEW.data_deteccao + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_prazo_notificacao_anpd
  BEFORE INSERT OR UPDATE ON lgpd_incidentes
  FOR EACH ROW
  EXECUTE FUNCTION calcular_prazo_notificacao_anpd();

-- ─── Função para registrar histórico de solicitação ───────────────────────────────

CREATE OR REPLACE FUNCTION registrar_historico_solicitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.historico := NEW.historico || jsonb_build_object(
      'timestamp', NOW(),
      'status_anterior', OLD.status,
      'status_novo', NEW.status,
      'usuario', auth.uid()
    );
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historico_solicitacao
  BEFORE UPDATE ON lgpd_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION registrar_historico_solicitacao();

-- ─── Função para registrar ação em incidente ──────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_acao_incidente(
  p_incidente_id UUID,
  p_acao TEXT,
  p_detalhes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lgpd_incidentes
  SET 
    timeline_acoes = timeline_acoes || jsonb_build_object(
      'timestamp', NOW(),
      'acao', p_acao,
      'detalhes', p_detalhes,
      'usuario', auth.uid()
    ),
    updated_at = NOW()
  WHERE id = p_incidente_id;
  
  RETURN FOUND;
END;
$$;

-- ─── View para solicitações pendentes ─────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_lgpd_solicitacoes_pendentes AS
SELECT 
  s.*,
  CASE 
    WHEN s.prazo_resposta < NOW() THEN 'ATRASADA'
    WHEN s.prazo_resposta < NOW() + INTERVAL '3 days' THEN 'URGENTE'
    ELSE 'NO_PRAZO'
  END AS situacao_prazo,
  EXTRACT(DAY FROM s.prazo_resposta - NOW()) AS dias_restantes
FROM lgpd_solicitacoes s
WHERE s.status NOT IN ('concluida', 'negada', 'cancelada');

-- ─── View para incidentes que requerem notificação ────────────────────────────────

CREATE OR REPLACE VIEW vw_lgpd_incidentes_notificacao AS
SELECT 
  i.*,
  CASE 
    WHEN i.prazo_notificacao < NOW() AND NOT i.notificacao_anpd_enviada THEN 'ATRASADA'
    WHEN i.prazo_notificacao < NOW() + INTERVAL '24 hours' AND NOT i.notificacao_anpd_enviada THEN 'URGENTE'
    ELSE 'NO_PRAZO'
  END AS situacao_notificacao,
  EXTRACT(HOUR FROM i.prazo_notificacao - NOW()) AS horas_restantes
FROM lgpd_incidentes i
WHERE i.requer_notificacao_anpd = true
  AND i.notificacao_anpd_enviada = false;
