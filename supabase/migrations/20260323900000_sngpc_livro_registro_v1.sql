-- SNGPC - Livro de Registro Digital de Medicamentos Controlados
-- Migration para tabelas de controle de estoque e movimentação

-- Tabela de estoque de medicamentos controlados
CREATE TABLE IF NOT EXISTS sngpc_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  medicamento_codigo TEXT NOT NULL,
  medicamento_nome TEXT NOT NULL,
  lista TEXT NOT NULL CHECK (lista IN ('A1','A2','A3','B1','B2','C1','C2','C3','C4','C5')),
  lote TEXT NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade_inicial INTEGER NOT NULL,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'comprimido',
  fornecedor_id UUID REFERENCES suppliers(id),
  nota_fiscal TEXT,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  preco_unitario DECIMAL(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT quantidade_positiva CHECK (quantidade_atual >= 0)
);

-- Tabela de movimentações (livro de registro)
CREATE TABLE IF NOT EXISTS sngpc_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estoque_id UUID NOT NULL REFERENCES sngpc_estoque(id) ON DELETE CASCADE,
  tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN (
    'ENTRADA_COMPRA',
    'ENTRADA_TRANSFERENCIA',
    'ENTRADA_DEVOLUCAO',
    'SAIDA_DISPENSACAO',
    'SAIDA_PERDA',
    'SAIDA_VENCIMENTO',
    'SAIDA_TRANSFERENCIA',
    'SAIDA_APREENSAO',
    'AJUSTE_INVENTARIO'
  )),
  quantidade INTEGER NOT NULL,
  saldo_anterior INTEGER NOT NULL,
  saldo_posterior INTEGER NOT NULL,
  
  -- Dados da dispensação (quando aplicável)
  paciente_id UUID REFERENCES clients(id),
  paciente_nome TEXT,
  paciente_cpf TEXT,
  prescricao_id UUID,
  prescriptor_nome TEXT,
  prescriptor_crm TEXT,
  numero_receita TEXT,
  
  -- Dados do comprador (quando diferente do paciente)
  comprador_nome TEXT,
  comprador_rg TEXT,
  comprador_endereco TEXT,
  comprador_telefone TEXT,
  comprador_parentesco TEXT,
  
  -- Dados de entrada (quando aplicável)
  fornecedor_nome TEXT,
  nota_fiscal TEXT,
  
  -- Dados de perda/vencimento (quando aplicável)
  motivo_perda TEXT,
  numero_boletim_ocorrencia TEXT,
  
  -- Auditoria
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT NOT NULL,
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de notificações de receita emitidas
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
  paciente_id UUID REFERENCES clients(id),
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

-- Tabela de sequencial de notificações por tenant
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_tenant ON sngpc_estoque(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_medicamento ON sngpc_estoque(medicamento_codigo);
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_lista ON sngpc_estoque(lista);
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_lote ON sngpc_estoque(lote);
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_validade ON sngpc_estoque(data_validade);

CREATE INDEX IF NOT EXISTS idx_sngpc_mov_tenant ON sngpc_movimentacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_estoque ON sngpc_movimentacoes(estoque_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_tipo ON sngpc_movimentacoes(tipo_movimentacao);
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_data ON sngpc_movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_paciente ON sngpc_movimentacoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_receita ON sngpc_movimentacoes(numero_receita);

CREATE INDEX IF NOT EXISTS idx_sngpc_notif_tenant ON sngpc_notificacoes_receita(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_numero ON sngpc_notificacoes_receita(numero, serie);
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_paciente ON sngpc_notificacoes_receita(paciente_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_data ON sngpc_notificacoes_receita(data_emissao);
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_status ON sngpc_notificacoes_receita(status);

-- RLS Policies
ALTER TABLE sngpc_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_notificacoes_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE sngpc_sequencial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sngpc_estoque_tenant_isolation" ON sngpc_estoque
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "sngpc_movimentacoes_tenant_isolation" ON sngpc_movimentacoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "sngpc_notificacoes_tenant_isolation" ON sngpc_notificacoes_receita
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "sngpc_sequencial_tenant_isolation" ON sngpc_sequencial
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Função para obter próximo número de notificação
CREATE OR REPLACE FUNCTION sngpc_proximo_numero(
  p_tenant_id UUID,
  p_tipo_receituario TEXT
) RETURNS TABLE(numero TEXT, serie TEXT) AS $$
DECLARE
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_sequencial INTEGER;
  v_prefixo TEXT;
BEGIN
  -- Determinar prefixo
  v_prefixo := CASE p_tipo_receituario
    WHEN 'AMARELA' THEN 'A'
    WHEN 'AZUL' THEN 'B'
    ELSE 'C'
  END;
  
  -- Inserir ou atualizar sequencial
  INSERT INTO sngpc_sequencial (tenant_id, tipo_receituario, ano, ultimo_numero)
  VALUES (p_tenant_id, p_tipo_receituario, v_ano, 1)
  ON CONFLICT (tenant_id, tipo_receituario, ano)
  DO UPDATE SET 
    ultimo_numero = sngpc_sequencial.ultimo_numero + 1,
    updated_at = NOW()
  RETURNING ultimo_numero INTO v_sequencial;
  
  RETURN QUERY SELECT 
    LPAD(v_sequencial::TEXT, 6, '0'),
    v_prefixo || v_ano::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar entrada de medicamento
CREATE OR REPLACE FUNCTION sngpc_registrar_entrada(
  p_tenant_id UUID,
  p_medicamento_codigo TEXT,
  p_medicamento_nome TEXT,
  p_lista TEXT,
  p_lote TEXT,
  p_data_fabricacao DATE,
  p_data_validade DATE,
  p_quantidade INTEGER,
  p_unidade TEXT,
  p_fornecedor_id UUID,
  p_nota_fiscal TEXT,
  p_preco_unitario DECIMAL,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_observacoes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_estoque_id UUID;
BEGIN
  -- Inserir no estoque
  INSERT INTO sngpc_estoque (
    tenant_id, medicamento_codigo, medicamento_nome, lista,
    lote, data_fabricacao, data_validade, quantidade_inicial,
    quantidade_atual, unidade, fornecedor_id, nota_fiscal,
    preco_unitario, observacoes
  ) VALUES (
    p_tenant_id, p_medicamento_codigo, p_medicamento_nome, p_lista,
    p_lote, p_data_fabricacao, p_data_validade, p_quantidade,
    p_quantidade, p_unidade, p_fornecedor_id, p_nota_fiscal,
    p_preco_unitario, p_observacoes
  ) RETURNING id INTO v_estoque_id;
  
  -- Registrar movimentação
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior, fornecedor_nome, nota_fiscal,
    usuario_id, usuario_nome, observacoes
  ) VALUES (
    p_tenant_id, v_estoque_id, 'ENTRADA_COMPRA', p_quantidade,
    0, p_quantidade,
    (SELECT name FROM suppliers WHERE id = p_fornecedor_id),
    p_nota_fiscal, p_usuario_id, p_usuario_nome, p_observacoes
  );
  
  RETURN v_estoque_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar dispensação
CREATE OR REPLACE FUNCTION sngpc_registrar_dispensacao(
  p_tenant_id UUID,
  p_estoque_id UUID,
  p_quantidade INTEGER,
  p_paciente_id UUID,
  p_paciente_nome TEXT,
  p_paciente_cpf TEXT,
  p_prescriptor_nome TEXT,
  p_prescriptor_crm TEXT,
  p_numero_receita TEXT,
  p_comprador_nome TEXT DEFAULT NULL,
  p_comprador_rg TEXT DEFAULT NULL,
  p_comprador_endereco TEXT DEFAULT NULL,
  p_comprador_telefone TEXT DEFAULT NULL,
  p_comprador_parentesco TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_saldo_atual INTEGER;
  v_mov_id UUID;
BEGIN
  -- Obter saldo atual
  SELECT quantidade_atual INTO v_saldo_atual
  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;
  
  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_saldo_atual, p_quantidade;
  END IF;
  
  -- Atualizar estoque
  UPDATE sngpc_estoque 
  SET quantidade_atual = quantidade_atual - p_quantidade,
      updated_at = NOW()
  WHERE id = p_estoque_id;
  
  -- Registrar movimentação
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior,
    paciente_id, paciente_nome, paciente_cpf,
    prescriptor_nome, prescriptor_crm, numero_receita,
    comprador_nome, comprador_rg, comprador_endereco,
    comprador_telefone, comprador_parentesco,
    usuario_id, usuario_nome, observacoes
  ) VALUES (
    p_tenant_id, p_estoque_id, 'SAIDA_DISPENSACAO', p_quantidade,
    v_saldo_atual, v_saldo_atual - p_quantidade,
    p_paciente_id, p_paciente_nome, p_paciente_cpf,
    p_prescriptor_nome, p_prescriptor_crm, p_numero_receita,
    p_comprador_nome, p_comprador_rg, p_comprador_endereco,
    p_comprador_telefone, p_comprador_parentesco,
    p_usuario_id, p_usuario_nome, p_observacoes
  ) RETURNING id INTO v_mov_id;
  
  RETURN v_mov_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar perda/vencimento
CREATE OR REPLACE FUNCTION sngpc_registrar_perda(
  p_tenant_id UUID,
  p_estoque_id UUID,
  p_quantidade INTEGER,
  p_tipo TEXT, -- 'SAIDA_PERDA' ou 'SAIDA_VENCIMENTO'
  p_motivo TEXT,
  p_boletim_ocorrencia TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_saldo_atual INTEGER;
  v_mov_id UUID;
BEGIN
  SELECT quantidade_atual INTO v_saldo_atual
  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;
  
  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Quantidade a baixar maior que saldo disponível';
  END IF;
  
  UPDATE sngpc_estoque 
  SET quantidade_atual = quantidade_atual - p_quantidade,
      updated_at = NOW()
  WHERE id = p_estoque_id;
  
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior,
    motivo_perda, numero_boletim_ocorrencia,
    usuario_id, usuario_nome
  ) VALUES (
    p_tenant_id, p_estoque_id, p_tipo, p_quantidade,
    v_saldo_atual, v_saldo_atual - p_quantidade,
    p_motivo, p_boletim_ocorrencia,
    p_usuario_id, p_usuario_nome
  ) RETURNING id INTO v_mov_id;
  
  RETURN v_mov_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para livro de registro consolidado
CREATE OR REPLACE VIEW sngpc_livro_registro AS
SELECT 
  m.id,
  m.tenant_id,
  m.data_movimentacao,
  m.tipo_movimentacao,
  e.medicamento_codigo,
  e.medicamento_nome,
  e.lista,
  e.lote,
  m.quantidade,
  m.saldo_anterior,
  m.saldo_posterior,
  m.paciente_nome,
  m.paciente_cpf,
  m.prescriptor_nome,
  m.prescriptor_crm,
  m.numero_receita,
  m.comprador_nome,
  m.comprador_rg,
  m.fornecedor_nome,
  m.nota_fiscal,
  m.motivo_perda,
  m.usuario_nome,
  m.observacoes
FROM sngpc_movimentacoes m
JOIN sngpc_estoque e ON e.id = m.estoque_id
ORDER BY m.data_movimentacao DESC;

-- View para balanço de estoque
CREATE OR REPLACE VIEW sngpc_balanco_estoque AS
SELECT 
  tenant_id,
  medicamento_codigo,
  medicamento_nome,
  lista,
  SUM(quantidade_atual) as quantidade_total,
  COUNT(DISTINCT lote) as qtd_lotes,
  MIN(data_validade) as proxima_validade,
  SUM(quantidade_atual * COALESCE(preco_unitario, 0)) as valor_total
FROM sngpc_estoque
WHERE quantidade_atual > 0
GROUP BY tenant_id, medicamento_codigo, medicamento_nome, lista;
