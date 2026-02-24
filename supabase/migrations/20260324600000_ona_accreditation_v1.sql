-- ============================================================================
-- FASE 22: Acreditação ONA (Organização Nacional de Acreditação)
-- Sistema de Eventos Adversos + Indicadores de Qualidade
-- ============================================================================

-- ─── 22.1 Sistema de Eventos Adversos ─────────────────────────────────────────

-- Tipos de eventos adversos (classificação ONA/ANVISA)
CREATE TYPE adverse_event_type AS ENUM (
  'QUEDA',
  'ERRO_MEDICACAO',
  'LESAO_PRESSAO',
  'INFECCAO',
  'IDENTIFICACAO_INCORRETA',
  'FALHA_COMUNICACAO',
  'FALHA_EQUIPAMENTO',
  'REACAO_ADVERSA',
  'EXTRAVIO_MATERIAL',
  'OUTRO'
);

-- Severidade do evento (classificação ONA)
CREATE TYPE adverse_event_severity AS ENUM (
  'NEAR_MISS',      -- Quase-erro (interceptado antes de atingir paciente)
  'LEVE',           -- Sem dano ou dano mínimo
  'MODERADO',       -- Dano temporário com intervenção
  'GRAVE',          -- Dano permanente ou risco de vida
  'OBITO'           -- Óbito relacionado ao evento
);

-- Status do workflow de investigação
CREATE TYPE adverse_event_status AS ENUM (
  'NOTIFICADO',     -- Recém-reportado
  'EM_ANALISE',     -- Sob investigação
  'ACAO_CORRETIVA', -- Ações sendo implementadas
  'ENCERRADO',      -- Investigação concluída
  'REABERTO'        -- Reaberto para nova análise
);

-- Tabela principal de eventos adversos
CREATE TABLE IF NOT EXISTS adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação do evento
  numero_notificacao TEXT NOT NULL,
  data_evento TIMESTAMPTZ NOT NULL,
  data_notificacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Classificação
  tipo adverse_event_type NOT NULL,
  tipo_outro TEXT, -- Se tipo = 'OUTRO'
  severidade adverse_event_severity NOT NULL,
  
  -- Envolvidos
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  setor TEXT,
  local_evento TEXT,
  
  -- Descrição
  descricao TEXT NOT NULL,
  circunstancias TEXT,
  testemunhas TEXT,
  
  -- Workflow
  status adverse_event_status NOT NULL DEFAULT 'NOTIFICADO',
  notificado_por UUID REFERENCES auth.users(id),
  responsavel_investigacao UUID REFERENCES auth.users(id),
  
  -- Análise de causa raiz
  causa_raiz TEXT,
  fatores_contribuintes TEXT[],
  
  -- Ações
  acoes_imediatas TEXT,
  acoes_corretivas TEXT,
  acoes_preventivas TEXT,
  prazo_acoes DATE,
  
  -- Encerramento
  data_encerramento TIMESTAMPTZ,
  conclusao TEXT,
  licoes_aprendidas TEXT,
  
  -- Notificação externa (ANVISA/Vigilância)
  notificado_anvisa BOOLEAN DEFAULT FALSE,
  data_notificacao_anvisa TIMESTAMPTZ,
  protocolo_anvisa TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de alterações do evento
CREATE TABLE IF NOT EXISTS adverse_events_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'STATUS_CHANGE', 'UPDATE', 'COMMENT'
  old_status adverse_event_status,
  new_status adverse_event_status,
  comentario TEXT,
  dados_alterados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anexos do evento (fotos, documentos)
CREATE TABLE IF NOT EXISTS adverse_events_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 22.2-22.7 Indicadores ONA ────────────────────────────────────────────────

-- Tabela de snapshots de indicadores (calculados periodicamente)
CREATE TABLE IF NOT EXISTS ona_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Período de referência
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  tipo_periodo TEXT NOT NULL DEFAULT 'MENSAL', -- DIARIO, SEMANAL, MENSAL
  
  -- 22.2 Tempo médio de espera (minutos)
  tempo_espera_medio NUMERIC(10,2),
  tempo_espera_min NUMERIC(10,2),
  tempo_espera_max NUMERIC(10,2),
  tempo_espera_p90 NUMERIC(10,2), -- Percentil 90
  total_atendimentos_espera INTEGER,
  
  -- 22.3 Taxa de cancelamento/no-show (%)
  taxa_cancelamento NUMERIC(5,2),
  taxa_noshow NUMERIC(5,2),
  total_agendamentos INTEGER,
  total_cancelados INTEGER,
  total_noshow INTEGER,
  total_realizados INTEGER,
  
  -- 22.4 Completude do prontuário (%)
  completude_prontuario NUMERIC(5,2),
  total_prontuarios INTEGER,
  prontuarios_completos INTEGER,
  campos_obrigatorios_faltantes JSONB, -- {"campo": count}
  
  -- 22.5 Taxa de ocupação de salas (%)
  taxa_ocupacao_salas NUMERIC(5,2),
  horas_disponiveis NUMERIC(10,2),
  horas_ocupadas NUMERIC(10,2),
  ocupacao_por_sala JSONB, -- {"sala_id": {"nome": "...", "taxa": 85.5}}
  
  -- 22.6 Taxa de retorno não programado (%)
  taxa_retorno_nao_programado NUMERIC(5,2),
  total_retornos_7dias INTEGER,
  total_atendimentos_periodo INTEGER,
  
  -- 22.7 NPS (Net Promoter Score)
  nps_score NUMERIC(5,2),
  nps_promotores INTEGER,
  nps_neutros INTEGER,
  nps_detratores INTEGER,
  total_respostas_nps INTEGER,
  
  -- Eventos adversos do período
  total_eventos_adversos INTEGER,
  eventos_por_severidade JSONB, -- {"LEVE": 2, "MODERADO": 1}
  eventos_por_tipo JSONB,
  
  -- Metadados
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculado_por TEXT DEFAULT 'SISTEMA',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, periodo_inicio, periodo_fim, tipo_periodo)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_adverse_events_tenant ON adverse_events(tenant_id);
CREATE INDEX idx_adverse_events_status ON adverse_events(tenant_id, status);
CREATE INDEX idx_adverse_events_data ON adverse_events(tenant_id, data_evento);
CREATE INDEX idx_adverse_events_severidade ON adverse_events(tenant_id, severidade);
CREATE INDEX idx_adverse_events_tipo ON adverse_events(tenant_id, tipo);
CREATE INDEX idx_adverse_events_client ON adverse_events(client_id);

CREATE INDEX idx_ona_indicators_tenant ON ona_indicators(tenant_id);
CREATE INDEX idx_ona_indicators_periodo ON ona_indicators(tenant_id, periodo_inicio, periodo_fim);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE adverse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE adverse_events_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE adverse_events_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ona_indicators ENABLE ROW LEVEL SECURITY;

-- Políticas para adverse_events
CREATE POLICY "adverse_events_tenant_isolation" ON adverse_events
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "adverse_events_history_tenant_isolation" ON adverse_events_history
  FOR ALL USING (
    adverse_event_id IN (
      SELECT id FROM adverse_events 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "adverse_events_attachments_tenant_isolation" ON adverse_events_attachments
  FOR ALL USING (
    adverse_event_id IN (
      SELECT id FROM adverse_events 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "ona_indicators_tenant_isolation" ON ona_indicators
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─── Funções de Cálculo de Indicadores ────────────────────────────────────────

-- 22.2 Calcular tempo médio de espera
CREATE OR REPLACE FUNCTION calc_tempo_espera(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  media NUMERIC,
  minimo NUMERIC,
  maximo NUMERIC,
  p90 NUMERIC,
  total INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as media,
    ROUND(MIN(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as minimo,
    ROUND(MAX(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as maximo,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as p90,
    COUNT(*)::INTEGER as total
  FROM appointments a
  JOIN triages t ON t.appointment_id = a.id
  WHERE a.tenant_id = p_tenant_id
    AND a.date BETWEEN p_inicio AND p_fim
    AND a.status = 'completed'
    AND t.created_at IS NOT NULL
    AND a.start_time IS NOT NULL
    AND a.start_time > t.created_at;
END;
$$;

-- 22.3 Calcular taxa de cancelamento/no-show
CREATE OR REPLACE FUNCTION calc_taxa_cancelamento(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa_cancel NUMERIC,
  taxa_ns NUMERIC,
  total_agend INTEGER,
  total_cancel INTEGER,
  total_ns INTEGER,
  total_realiz INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND((COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_cancel,
    ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_ns,
    COUNT(*)::INTEGER as total_agend,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER as total_cancel,
    COUNT(*) FILTER (WHERE status = 'no_show')::INTEGER as total_ns,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as total_realiz
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_inicio AND p_fim;
END;
$$;

-- 22.4 Calcular completude do prontuário
CREATE OR REPLACE FUNCTION calc_completude_prontuario(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  completude NUMERIC,
  total INTEGER,
  completos INTEGER,
  campos_faltantes JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_completos INTEGER;
  v_campos JSONB := '{}';
BEGIN
  -- Conta prontuários do período
  SELECT COUNT(*) INTO v_total
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
  
  -- Conta prontuários com campos obrigatórios preenchidos
  SELECT COUNT(*) INTO v_completos
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim
    AND subjective IS NOT NULL AND subjective != ''
    AND objective IS NOT NULL AND objective != ''
    AND assessment IS NOT NULL AND assessment != ''
    AND plan IS NOT NULL AND plan != '';
  
  -- Conta campos faltantes
  SELECT jsonb_build_object(
    'subjective', COUNT(*) FILTER (WHERE subjective IS NULL OR subjective = ''),
    'objective', COUNT(*) FILTER (WHERE objective IS NULL OR objective = ''),
    'assessment', COUNT(*) FILTER (WHERE assessment IS NULL OR assessment = ''),
    'plan', COUNT(*) FILTER (WHERE plan IS NULL OR plan = '')
  ) INTO v_campos
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
  
  RETURN QUERY SELECT 
    ROUND((v_completos::NUMERIC / NULLIF(v_total, 0) * 100), 2),
    v_total,
    v_completos,
    v_campos;
END;
$$;

-- 22.5 Calcular taxa de ocupação de salas
CREATE OR REPLACE FUNCTION calc_ocupacao_salas(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa NUMERIC,
  horas_disp NUMERIC,
  horas_ocup NUMERIC,
  por_sala JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dias INTEGER;
  v_salas INTEGER;
  v_horas_dia NUMERIC := 10; -- 10 horas úteis por dia
  v_horas_disp NUMERIC;
  v_horas_ocup NUMERIC;
  v_por_sala JSONB;
BEGIN
  -- Calcula dias úteis no período (simplificado)
  v_dias := (p_fim - p_inicio) + 1;
  
  -- Conta salas ativas
  SELECT COUNT(*) INTO v_salas
  FROM rooms
  WHERE tenant_id = p_tenant_id AND is_active = true;
  
  v_horas_disp := v_dias * v_salas * v_horas_dia;
  
  -- Calcula horas ocupadas
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (
      COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
    )) / 3600
  ), 0) INTO v_horas_ocup
  FROM room_occupancies ro
  JOIN rooms r ON r.id = ro.room_id
  WHERE r.tenant_id = p_tenant_id
    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim;
  
  -- Ocupação por sala
  SELECT COALESCE(jsonb_object_agg(
    r.id::TEXT,
    jsonb_build_object(
      'nome', r.name,
      'horas', ROUND(SUM(EXTRACT(EPOCH FROM (
        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
      )) / 3600)::NUMERIC, 2),
      'taxa', ROUND((SUM(EXTRACT(EPOCH FROM (
        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
      )) / 3600) / (v_dias * v_horas_dia) * 100)::NUMERIC, 2)
    )
  ), '{}') INTO v_por_sala
  FROM rooms r
  LEFT JOIN room_occupancies ro ON ro.room_id = r.id 
    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim
  WHERE r.tenant_id = p_tenant_id AND r.is_active = true
  GROUP BY r.id, r.name;
  
  RETURN QUERY SELECT 
    ROUND((v_horas_ocup / NULLIF(v_horas_disp, 0) * 100), 2),
    ROUND(v_horas_disp, 2),
    ROUND(v_horas_ocup, 2),
    v_por_sala;
END;
$$;

-- 22.6 Calcular taxa de retorno não programado
CREATE OR REPLACE FUNCTION calc_retorno_nao_programado(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa NUMERIC,
  retornos_7dias INTEGER,
  total_atend INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH atendimentos AS (
    SELECT 
      a.id,
      a.client_id,
      a.date,
      LAG(a.date) OVER (PARTITION BY a.client_id ORDER BY a.date) as data_anterior
    FROM appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'completed'
      AND a.date BETWEEN p_inicio AND p_fim
  )
  SELECT 
    ROUND((COUNT(*) FILTER (WHERE date - data_anterior <= 7)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa,
    COUNT(*) FILTER (WHERE date - data_anterior <= 7)::INTEGER as retornos_7dias,
    COUNT(*)::INTEGER as total_atend
  FROM atendimentos;
END;
$$;

-- 22.7 Calcular NPS
CREATE OR REPLACE FUNCTION calc_nps(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  score NUMERIC,
  promotores INTEGER,
  neutros INTEGER,
  detratores INTEGER,
  total INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND((
      (COUNT(*) FILTER (WHERE rating >= 9)::NUMERIC - COUNT(*) FILTER (WHERE rating <= 6)::NUMERIC) 
      / NULLIF(COUNT(*), 0) * 100
    ), 2) as score,
    COUNT(*) FILTER (WHERE rating >= 9)::INTEGER as promotores,
    COUNT(*) FILTER (WHERE rating BETWEEN 7 AND 8)::INTEGER as neutros,
    COUNT(*) FILTER (WHERE rating <= 6)::INTEGER as detratores,
    COUNT(*)::INTEGER as total
  FROM nps_responses
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
END;
$$;

-- ─── Função Principal: Calcular Todos os Indicadores ──────────────────────────

CREATE OR REPLACE FUNCTION calcular_indicadores_ona(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE,
  p_tipo_periodo TEXT DEFAULT 'MENSAL'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_espera RECORD;
  v_cancel RECORD;
  v_prontuario RECORD;
  v_salas RECORD;
  v_retorno RECORD;
  v_nps RECORD;
  v_eventos RECORD;
BEGIN
  -- Calcula cada indicador
  SELECT * INTO v_espera FROM calc_tempo_espera(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_cancel FROM calc_taxa_cancelamento(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_prontuario FROM calc_completude_prontuario(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_salas FROM calc_ocupacao_salas(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_retorno FROM calc_retorno_nao_programado(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_nps FROM calc_nps(p_tenant_id, p_inicio, p_fim);
  
  -- Conta eventos adversos
  SELECT 
    COUNT(*) as total,
    jsonb_object_agg(severidade, cnt) FILTER (WHERE severidade IS NOT NULL) as por_severidade,
    jsonb_object_agg(tipo, cnt) FILTER (WHERE tipo IS NOT NULL) as por_tipo
  INTO v_eventos
  FROM (
    SELECT severidade::TEXT, COUNT(*) as cnt FROM adverse_events 
    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim
    GROUP BY severidade
  ) s, (
    SELECT tipo::TEXT, COUNT(*) as cnt FROM adverse_events 
    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim
    GROUP BY tipo
  ) t;
  
  -- Insere ou atualiza snapshot
  INSERT INTO ona_indicators (
    tenant_id, periodo_inicio, periodo_fim, tipo_periodo,
    tempo_espera_medio, tempo_espera_min, tempo_espera_max, tempo_espera_p90, total_atendimentos_espera,
    taxa_cancelamento, taxa_noshow, total_agendamentos, total_cancelados, total_noshow, total_realizados,
    completude_prontuario, total_prontuarios, prontuarios_completos, campos_obrigatorios_faltantes,
    taxa_ocupacao_salas, horas_disponiveis, horas_ocupadas, ocupacao_por_sala,
    taxa_retorno_nao_programado, total_retornos_7dias, total_atendimentos_periodo,
    nps_score, nps_promotores, nps_neutros, nps_detratores, total_respostas_nps,
    total_eventos_adversos, eventos_por_severidade, eventos_por_tipo
  ) VALUES (
    p_tenant_id, p_inicio, p_fim, p_tipo_periodo,
    v_espera.media, v_espera.minimo, v_espera.maximo, v_espera.p90, v_espera.total,
    v_cancel.taxa_cancel, v_cancel.taxa_ns, v_cancel.total_agend, v_cancel.total_cancel, v_cancel.total_ns, v_cancel.total_realiz,
    v_prontuario.completude, v_prontuario.total, v_prontuario.completos, v_prontuario.campos_faltantes,
    v_salas.taxa, v_salas.horas_disp, v_salas.horas_ocup, v_salas.por_sala,
    v_retorno.taxa, v_retorno.retornos_7dias, v_retorno.total_atend,
    v_nps.score, v_nps.promotores, v_nps.neutros, v_nps.detratores, v_nps.total,
    COALESCE(v_eventos.total, 0), v_eventos.por_severidade, v_eventos.por_tipo
  )
  ON CONFLICT (tenant_id, periodo_inicio, periodo_fim, tipo_periodo) 
  DO UPDATE SET
    tempo_espera_medio = EXCLUDED.tempo_espera_medio,
    tempo_espera_min = EXCLUDED.tempo_espera_min,
    tempo_espera_max = EXCLUDED.tempo_espera_max,
    tempo_espera_p90 = EXCLUDED.tempo_espera_p90,
    total_atendimentos_espera = EXCLUDED.total_atendimentos_espera,
    taxa_cancelamento = EXCLUDED.taxa_cancelamento,
    taxa_noshow = EXCLUDED.taxa_noshow,
    total_agendamentos = EXCLUDED.total_agendamentos,
    total_cancelados = EXCLUDED.total_cancelados,
    total_noshow = EXCLUDED.total_noshow,
    total_realizados = EXCLUDED.total_realizados,
    completude_prontuario = EXCLUDED.completude_prontuario,
    total_prontuarios = EXCLUDED.total_prontuarios,
    prontuarios_completos = EXCLUDED.prontuarios_completos,
    campos_obrigatorios_faltantes = EXCLUDED.campos_obrigatorios_faltantes,
    taxa_ocupacao_salas = EXCLUDED.taxa_ocupacao_salas,
    horas_disponiveis = EXCLUDED.horas_disponiveis,
    horas_ocupadas = EXCLUDED.horas_ocupadas,
    ocupacao_por_sala = EXCLUDED.ocupacao_por_sala,
    taxa_retorno_nao_programado = EXCLUDED.taxa_retorno_nao_programado,
    total_retornos_7dias = EXCLUDED.total_retornos_7dias,
    total_atendimentos_periodo = EXCLUDED.total_atendimentos_periodo,
    nps_score = EXCLUDED.nps_score,
    nps_promotores = EXCLUDED.nps_promotores,
    nps_neutros = EXCLUDED.nps_neutros,
    nps_detratores = EXCLUDED.nps_detratores,
    total_respostas_nps = EXCLUDED.total_respostas_nps,
    total_eventos_adversos = EXCLUDED.total_eventos_adversos,
    eventos_por_severidade = EXCLUDED.eventos_por_severidade,
    eventos_por_tipo = EXCLUDED.eventos_por_tipo,
    calculado_em = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ─── Trigger para histórico de eventos adversos ───────────────────────────────

CREATE OR REPLACE FUNCTION log_adverse_event_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO adverse_events_history (
      adverse_event_id, user_id, action, old_status, new_status
    ) VALUES (
      NEW.id, auth.uid(), 'STATUS_CHANGE', OLD.status, NEW.status
    );
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_adverse_event_change
  BEFORE UPDATE ON adverse_events
  FOR EACH ROW EXECUTE FUNCTION log_adverse_event_change();

-- ─── Gerador de número de notificação ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_adverse_event_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM adverse_events
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  RETURN 'EA-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;
