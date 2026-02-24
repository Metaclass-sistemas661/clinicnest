-- ============================================================================
-- FASE 24B: Painel de Chamada (Fila Visual)
-- Sistema de chamada de pacientes para TV/recepção
-- ============================================================================

-- ─── Tabela de chamadas ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Paciente e atendimento
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  triage_id UUID REFERENCES triage_records(id) ON DELETE SET NULL,
  
  -- Destino
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  room_name TEXT,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  professional_name TEXT,
  
  -- Status da chamada
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting',    -- Na fila de espera
    'calling',    -- Sendo chamado agora
    'called',     -- Já foi chamado
    'in_service', -- Em atendimento
    'completed',  -- Atendimento concluído
    'no_show'     -- Não compareceu
  )),
  
  -- Prioridade (da triagem)
  priority INTEGER DEFAULT 5, -- 1=emergência, 5=normal
  priority_label TEXT,
  
  -- Controle de chamada
  call_number INTEGER, -- Número sequencial do dia
  times_called INTEGER DEFAULT 0,
  first_called_at TIMESTAMPTZ,
  last_called_at TIMESTAMPTZ,
  
  -- Timestamps
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_service_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_patient_calls_tenant ON patient_calls(tenant_id);
CREATE INDEX idx_patient_calls_status ON patient_calls(tenant_id, status);
CREATE INDEX idx_patient_calls_date ON patient_calls(tenant_id, created_at);
CREATE INDEX idx_patient_calls_waiting ON patient_calls(tenant_id, priority, checked_in_at) 
  WHERE status = 'waiting';

-- RLS
ALTER TABLE patient_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_calls_tenant_isolation" ON patient_calls
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─── Função para gerar número de chamada do dia ───────────────────────────────

CREATE OR REPLACE FUNCTION generate_call_number(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(call_number), 0) + 1 INTO v_number
  FROM patient_calls
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE = CURRENT_DATE;
  
  RETURN v_number;
END;
$$;

-- ─── Função para adicionar paciente à fila ────────────────────────────────────

CREATE OR REPLACE FUNCTION add_patient_to_queue(
  p_tenant_id UUID,
  p_client_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_triage_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_priority_label TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID;
  v_call_number INTEGER;
  v_room_name TEXT;
  v_professional_name TEXT;
BEGIN
  -- Gera número de chamada
  v_call_number := generate_call_number(p_tenant_id);
  
  -- Busca nomes
  IF p_room_id IS NOT NULL THEN
    SELECT name INTO v_room_name FROM rooms WHERE id = p_room_id;
  END IF;
  
  IF p_professional_id IS NOT NULL THEN
    SELECT name INTO v_professional_name FROM professionals WHERE id = p_professional_id;
  END IF;
  
  -- Insere na fila
  INSERT INTO patient_calls (
    tenant_id, client_id, appointment_id, triage_id,
    room_id, room_name, professional_id, professional_name,
    priority, priority_label, call_number, status
  ) VALUES (
    p_tenant_id, p_client_id, p_appointment_id, p_triage_id,
    p_room_id, v_room_name, p_professional_id, v_professional_name,
    p_priority, p_priority_label, v_call_number, 'waiting'
  ) RETURNING id INTO v_call_id;
  
  RETURN v_call_id;
END;
$$;

-- ─── Função para chamar próximo paciente ──────────────────────────────────────

CREATE OR REPLACE FUNCTION call_next_patient(
  p_tenant_id UUID,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL
) RETURNS TABLE (
  call_id UUID,
  client_id UUID,
  client_name TEXT,
  room_name TEXT,
  professional_name TEXT,
  call_number INTEGER,
  priority INTEGER,
  priority_label TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID;
  v_room_name TEXT;
  v_professional_name TEXT;
BEGIN
  -- Busca nomes se fornecidos
  IF p_room_id IS NOT NULL THEN
    SELECT name INTO v_room_name FROM rooms WHERE id = p_room_id;
  END IF;
  
  IF p_professional_id IS NOT NULL THEN
    SELECT name INTO v_professional_name FROM professionals WHERE id = p_professional_id;
  END IF;

  -- Busca próximo paciente (por prioridade, depois por ordem de chegada)
  SELECT pc.id INTO v_call_id
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND (p_room_id IS NULL OR pc.room_id = p_room_id OR pc.room_id IS NULL)
    AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id OR pc.professional_id IS NULL)
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT 1;
  
  IF v_call_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Atualiza status para "calling"
  UPDATE patient_calls
  SET 
    status = 'calling',
    room_id = COALESCE(p_room_id, room_id),
    room_name = COALESCE(v_room_name, room_name),
    professional_id = COALESCE(p_professional_id, professional_id),
    professional_name = COALESCE(v_professional_name, professional_name),
    times_called = times_called + 1,
    first_called_at = COALESCE(first_called_at, NOW()),
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE id = v_call_id;
  
  -- Retorna dados do paciente chamado
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.client_id,
    c.name as client_name,
    pc.room_name,
    pc.professional_name,
    pc.call_number,
    pc.priority,
    pc.priority_label
  FROM patient_calls pc
  JOIN clients c ON c.id = pc.client_id
  WHERE pc.id = v_call_id;
END;
$$;

-- ─── Função para rechamar paciente ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recall_patient(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls
  SET 
    status = 'calling',
    times_called = times_called + 1,
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id;
END;
$$;

-- ─── Função para iniciar atendimento ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION start_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls
  SET 
    status = 'in_service',
    started_service_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id;
END;
$$;

-- ─── Função para finalizar atendimento ────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id;
END;
$$;

-- ─── Função para marcar no-show ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_patient_no_show(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls
  SET 
    status = 'no_show',
    updated_at = NOW()
  WHERE id = p_call_id;
END;
$$;

-- ─── Função para buscar fila de espera ────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_waiting_queue(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  call_id UUID,
  client_id UUID,
  client_name TEXT,
  call_number INTEGER,
  priority INTEGER,
  priority_label TEXT,
  room_name TEXT,
  professional_name TEXT,
  checked_in_at TIMESTAMPTZ,
  wait_time_minutes INTEGER,
  queue_position INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.client_id,
    c.name as client_name,
    pc.call_number,
    pc.priority,
    pc.priority_label,
    pc.room_name,
    pc.professional_name,
    pc.checked_in_at,
    EXTRACT(EPOCH FROM (NOW() - pc.checked_in_at))::INTEGER / 60 as wait_time_minutes,
    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER as queue_position
  FROM patient_calls pc
  JOIN clients c ON c.id = pc.client_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT p_limit;
END;
$$;

-- ─── Função para buscar paciente sendo chamado ────────────────────────────────

CREATE OR REPLACE FUNCTION get_current_call(p_tenant_id UUID)
RETURNS TABLE (
  call_id UUID,
  client_id UUID,
  client_name TEXT,
  call_number INTEGER,
  room_name TEXT,
  professional_name TEXT,
  times_called INTEGER,
  last_called_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.client_id,
    c.name as client_name,
    pc.call_number,
    pc.room_name,
    pc.professional_name,
    pc.times_called,
    pc.last_called_at
  FROM patient_calls pc
  JOIN clients c ON c.id = pc.client_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'calling'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.last_called_at DESC
  LIMIT 1;
END;
$$;

-- ─── Função para estatísticas do dia ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_queue_statistics(p_tenant_id UUID)
RETURNS TABLE (
  total_today BIGINT,
  waiting_count BIGINT,
  calling_count BIGINT,
  in_service_count BIGINT,
  completed_count BIGINT,
  no_show_count BIGINT,
  avg_wait_time_minutes NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_today,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting_count,
    COUNT(*) FILTER (WHERE status = 'calling') as calling_count,
    COUNT(*) FILTER (WHERE status = 'in_service') as in_service_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show_count,
    ROUND(AVG(
      CASE WHEN started_service_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (started_service_at - checked_in_at)) / 60 
        ELSE NULL 
      END
    )::NUMERIC, 1) as avg_wait_time_minutes
  FROM patient_calls
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE = CURRENT_DATE;
END;
$$;

-- ─── Trigger para adicionar à fila quando triagem é criada ────────────────────

CREATE OR REPLACE FUNCTION auto_add_to_queue_on_triage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_priority INTEGER;
  v_priority_label TEXT;
BEGIN
  -- Mapeia classificação de risco para prioridade
  CASE NEW.risk_classification
    WHEN 'emergencia' THEN v_priority := 1; v_priority_label := 'Emergência';
    WHEN 'muito_urgente' THEN v_priority := 2; v_priority_label := 'Muito Urgente';
    WHEN 'urgente' THEN v_priority := 3; v_priority_label := 'Urgente';
    WHEN 'pouco_urgente' THEN v_priority := 4; v_priority_label := 'Pouco Urgente';
    ELSE v_priority := 5; v_priority_label := 'Normal';
  END CASE;
  
  -- Adiciona à fila
  PERFORM add_patient_to_queue(
    NEW.tenant_id,
    NEW.client_id,
    NEW.appointment_id,
    NEW.id,
    NULL, -- room_id será definido na chamada
    NULL, -- professional_id será definido na chamada
    v_priority,
    v_priority_label
  );
  
  RETURN NEW;
END;
$$;

-- Trigger opcional (descomente se quiser automático)
-- DROP TRIGGER IF EXISTS trg_auto_queue_on_triage ON triage_records;
-- CREATE TRIGGER trg_auto_queue_on_triage
--   AFTER INSERT ON triage_records
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_add_to_queue_on_triage();
