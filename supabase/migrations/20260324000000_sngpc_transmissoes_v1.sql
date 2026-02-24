-- SNGPC Transmissões - Histórico de envios para ANVISA
-- Fase 15B.6 - Histórico de transmissões

-- Enum para status da transmissão
CREATE TYPE sngpc_transmissao_status AS ENUM (
  'pendente',      -- Aguardando envio
  'enviado',       -- Enviado, aguardando validação
  'validado',      -- Validado pela ANVISA
  'erro',          -- Erro no envio ou validação
  'rejeitado'      -- Rejeitado pela ANVISA
);

-- Enum para tipo de transmissão
CREATE TYPE sngpc_transmissao_tipo AS ENUM (
  'movimentacao',  -- Movimentações do período
  'inventario',    -- Inventário/Balanço
  'retificacao'    -- Retificação de envio anterior
);

-- Tabela principal de transmissões
CREATE TABLE IF NOT EXISTS sngpc_transmissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  tipo sngpc_transmissao_tipo NOT NULL DEFAULT 'movimentacao',
  hash_anvisa VARCHAR(100), -- Hash retornado pela ANVISA
  protocolo VARCHAR(50), -- Protocolo de envio
  
  -- Período da transmissão
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  
  -- Dados da transmissão
  xml_enviado TEXT NOT NULL, -- XML completo enviado
  xml_compactado BYTEA, -- XML compactado (gzip) para economia de espaço
  
  -- Status e validação
  status sngpc_transmissao_status NOT NULL DEFAULT 'pendente',
  data_envio TIMESTAMPTZ,
  data_validacao TIMESTAMPTZ,
  
  -- Resposta da ANVISA
  resposta_anvisa JSONB, -- Resposta completa da API
  erros TEXT[], -- Lista de erros (se houver)
  avisos TEXT[], -- Lista de avisos
  
  -- Resumo do conteúdo
  total_entradas INTEGER DEFAULT 0,
  total_saidas_venda INTEGER DEFAULT 0,
  total_saidas_transferencia INTEGER DEFAULT 0,
  total_saidas_perda INTEGER DEFAULT 0,
  total_medicamentos INTEGER DEFAULT 0,
  
  -- Responsável
  enviado_por UUID REFERENCES auth.users(id),
  enviado_por_nome VARCHAR(200),
  enviado_por_cpf VARCHAR(14),
  
  -- Retificação
  transmissao_original_id UUID REFERENCES sngpc_transmissoes(id),
  motivo_retificacao TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sngpc_transmissoes_tenant ON sngpc_transmissoes(tenant_id);
CREATE INDEX idx_sngpc_transmissoes_status ON sngpc_transmissoes(status);
CREATE INDEX idx_sngpc_transmissoes_periodo ON sngpc_transmissoes(data_inicio, data_fim);
CREATE INDEX idx_sngpc_transmissoes_hash ON sngpc_transmissoes(hash_anvisa) WHERE hash_anvisa IS NOT NULL;
CREATE INDEX idx_sngpc_transmissoes_data_envio ON sngpc_transmissoes(data_envio DESC);

-- Tabela de log de tentativas (para retry e auditoria)
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
  executado_por UUID REFERENCES auth.users(id),
  executado_em TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_sngpc_log_transmissao ON sngpc_transmissoes_log(transmissao_id);
CREATE INDEX idx_sngpc_log_data ON sngpc_transmissoes_log(executado_em DESC);

-- Tabela de credenciais SNGPC (criptografadas)
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
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(tenant_id)
);

-- Tabela de agendamentos de transmissão automática
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

-- RLS Policies
ALTER TABLE sngpc_transmissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_transmissoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_credenciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_agendamentos ENABLE ROW LEVEL SECURITY;

-- Policies para transmissões
CREATE POLICY "Tenant isolation for sngpc_transmissoes" ON sngpc_transmissoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for sngpc_transmissoes_log" ON sngpc_transmissoes_log
  FOR ALL USING (
    transmissao_id IN (
      SELECT id FROM sngpc_transmissoes 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Tenant isolation for sngpc_credenciais" ON sngpc_credenciais
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for sngpc_agendamentos" ON sngpc_agendamentos
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_sngpc_transmissoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sngpc_transmissoes_updated_at
  BEFORE UPDATE ON sngpc_transmissoes
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();

CREATE TRIGGER trigger_sngpc_credenciais_updated_at
  BEFORE UPDATE ON sngpc_credenciais
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();

CREATE TRIGGER trigger_sngpc_agendamentos_updated_at
  BEFORE UPDATE ON sngpc_agendamentos
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();

-- Função para registrar log automaticamente
CREATE OR REPLACE FUNCTION log_sngpc_transmissao_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO sngpc_transmissoes_log (
      transmissao_id,
      acao,
      status_anterior,
      status_novo,
      executado_por
    ) VALUES (
      NEW.id,
      'mudanca_status',
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_sngpc_transmissao
  AFTER UPDATE ON sngpc_transmissoes
  FOR EACH ROW EXECUTE FUNCTION log_sngpc_transmissao_change();

-- View para dashboard de transmissões
CREATE OR REPLACE VIEW sngpc_transmissoes_dashboard AS
SELECT 
  t.tenant_id,
  COUNT(*) FILTER (WHERE t.status = 'validado') as total_validados,
  COUNT(*) FILTER (WHERE t.status = 'erro') as total_erros,
  COUNT(*) FILTER (WHERE t.status = 'pendente') as total_pendentes,
  COUNT(*) FILTER (WHERE t.status = 'enviado') as total_aguardando,
  COUNT(*) as total_transmissoes,
  MAX(t.data_envio) FILTER (WHERE t.status = 'validado') as ultima_transmissao_sucesso,
  MAX(t.data_envio) as ultima_tentativa,
  SUM(t.total_medicamentos) as total_medicamentos_transmitidos,
  ROUND(
    COUNT(*) FILTER (WHERE t.status = 'validado')::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as taxa_sucesso
FROM sngpc_transmissoes t
GROUP BY t.tenant_id;

-- Função RPC para criar transmissão
CREATE OR REPLACE FUNCTION criar_transmissao_sngpc(
  p_tipo sngpc_transmissao_tipo,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_xml TEXT,
  p_total_entradas INTEGER DEFAULT 0,
  p_total_saidas_venda INTEGER DEFAULT 0,
  p_total_saidas_transferencia INTEGER DEFAULT 0,
  p_total_saidas_perda INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_transmissao_id UUID;
BEGIN
  -- Obter tenant e usuário
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid();
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM profiles WHERE id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a um tenant';
  END IF;
  
  -- Criar transmissão
  INSERT INTO sngpc_transmissoes (
    tenant_id,
    tipo,
    data_inicio,
    data_fim,
    xml_enviado,
    status,
    total_entradas,
    total_saidas_venda,
    total_saidas_transferencia,
    total_saidas_perda,
    total_medicamentos,
    enviado_por,
    enviado_por_nome
  ) VALUES (
    v_tenant_id,
    p_tipo,
    p_data_inicio,
    p_data_fim,
    p_xml,
    'pendente',
    p_total_entradas,
    p_total_saidas_venda,
    p_total_saidas_transferencia,
    p_total_saidas_perda,
    p_total_entradas + p_total_saidas_venda + p_total_saidas_transferencia + p_total_saidas_perda,
    v_user_id,
    v_user_name
  )
  RETURNING id INTO v_transmissao_id;
  
  -- Registrar log
  INSERT INTO sngpc_transmissoes_log (
    transmissao_id,
    acao,
    status_novo,
    executado_por
  ) VALUES (
    v_transmissao_id,
    'criacao',
    'pendente',
    v_user_id
  );
  
  RETURN v_transmissao_id;
END;
$$;

-- Função RPC para atualizar status após envio
CREATE OR REPLACE FUNCTION atualizar_transmissao_sngpc(
  p_transmissao_id UUID,
  p_status sngpc_transmissao_status,
  p_hash VARCHAR DEFAULT NULL,
  p_resposta JSONB DEFAULT NULL,
  p_erros TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Verificar permissão
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid();
  
  IF NOT EXISTS (
    SELECT 1 FROM sngpc_transmissoes 
    WHERE id = p_transmissao_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Transmissão não encontrada ou sem permissão';
  END IF;
  
  -- Atualizar transmissão
  UPDATE sngpc_transmissoes SET
    status = p_status,
    hash_anvisa = COALESCE(p_hash, hash_anvisa),
    resposta_anvisa = COALESCE(p_resposta, resposta_anvisa),
    erros = COALESCE(p_erros, erros),
    data_envio = CASE WHEN p_status IN ('enviado', 'validado', 'erro', 'rejeitado') THEN COALESCE(data_envio, NOW()) ELSE data_envio END,
    data_validacao = CASE WHEN p_status = 'validado' THEN NOW() ELSE data_validacao END
  WHERE id = p_transmissao_id;
  
  RETURN TRUE;
END;
$$;

-- Comentários
COMMENT ON TABLE sngpc_transmissoes IS 'Histórico de transmissões SNGPC para ANVISA';
COMMENT ON TABLE sngpc_transmissoes_log IS 'Log de ações nas transmissões SNGPC';
COMMENT ON TABLE sngpc_credenciais IS 'Credenciais de acesso à API SNGPC (criptografadas)';
COMMENT ON TABLE sngpc_agendamentos IS 'Agendamentos de transmissão automática SNGPC';
