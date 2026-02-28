-- ============================================================================
-- FIX: Fluxo correto de triagem + fila de espera
-- ============================================================================
-- Fluxo brasileiro padrão (CFM / TASY / Feegow):
--   Check-in → Triagem (enfermagem) → Fila para Médico (consultório)
--
-- Problemas corrigidos:
-- 1. Trigger auto_add_to_queue_on_checkin não propagava room_id do agendamento
-- 2. Triagem era 100% desconectada da fila (patient_calls)
-- 3. get_waiting_queue não indicava se paciente foi triado
-- 4. Ao salvar triagem, prioridade da fila não era atualizada
-- 5. complete_patient_service não sincronizava com appointment
-- ============================================================================

-- ─── 1. Coluna is_triaged em patient_calls ──────────────────────────────────
-- Indica se o paciente já passou pela triagem nesta visita.

ALTER TABLE public.patient_calls
  ADD COLUMN IF NOT EXISTS is_triaged BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.patient_calls
  ADD COLUMN IF NOT EXISTS triage_priority TEXT;

COMMENT ON COLUMN public.patient_calls.is_triaged IS 'Se true, paciente já foi triado pela enfermagem';
COMMENT ON COLUMN public.patient_calls.triage_priority IS 'Prioridade vinda da triagem: emergencia/urgente/pouco_urgente/nao_urgente';

-- ─── 1b. DROP de funções com parâmetros renomeados (client→patient) ─────────
-- PostgreSQL não permite renomear parâmetros com CREATE OR REPLACE.

DROP FUNCTION IF EXISTS get_patient_priority(UUID);
DROP FUNCTION IF EXISTS add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT);

-- ─── 1c. get_patient_priority (recriação com p_patient_id) ──────────────────
-- Calcula prioridade automática com base em idade, gestante e PcD.

CREATE OR REPLACE FUNCTION get_patient_priority(p_patient_id UUID)
RETURNS TABLE (priority INTEGER, priority_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_birth_date DATE;
  v_age INTEGER;
  v_is_pregnant BOOLEAN;
  v_is_pcd BOOLEAN;
  v_notes TEXT;
BEGIN
  SELECT 
    COALESCE(c.date_of_birth, c.birth_date),
    LOWER(COALESCE(c.notes, '')) LIKE '%gestante%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%grávida%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%gravida%',
    LOWER(COALESCE(c.notes, '')) LIKE '%pcd%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiente%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%cadeirante%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiência%',
    c.notes
  INTO v_birth_date, v_is_pregnant, v_is_pcd, v_notes
  FROM patients c
  WHERE c.id = p_patient_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
    RETURN;
  END IF;
  
  IF v_birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));
  ELSE
    v_age := NULL;
  END IF;
  
  -- Prioridades (Estatuto do Idoso + Lei 10.048/2000):
  -- 1 = Emergência (definido pela triagem)
  -- 2 = Prioritário: Idosos 80+, Gestantes, PCD
  -- 3 = Preferencial: Idosos 60+
  -- 5 = Normal
  
  IF v_age IS NOT NULL AND v_age >= 80 THEN
    RETURN QUERY SELECT 2, 'Idoso 80+'::TEXT;
  ELSIF v_is_pregnant THEN
    RETURN QUERY SELECT 2, 'Gestante'::TEXT;
  ELSIF v_is_pcd THEN
    RETURN QUERY SELECT 2, 'PCD'::TEXT;
  ELSIF v_age IS NOT NULL AND v_age >= 60 THEN
    RETURN QUERY SELECT 3, 'Idoso 60+'::TEXT;
  ELSE
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
  END IF;
END;
$$;

-- ─── 1d. add_patient_to_queue (recriação com clinic_rooms) ──────────────────
-- Protegido contra inserção duplicada (double-check antes do INSERT).

CREATE OR REPLACE FUNCTION add_patient_to_queue(
  p_tenant_id UUID,
  p_patient_id UUID,
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
  v_existing_id UUID;
BEGIN
  -- Verifica se já está na fila hoje (double-check)
  SELECT id INTO v_existing_id
  FROM patient_calls
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id
    AND created_at::DATE = CURRENT_DATE
    AND status IN ('waiting', 'calling', 'in_service')
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_call_number := generate_call_number(p_tenant_id);
  
  IF p_room_id IS NOT NULL THEN
    SELECT name INTO v_room_name FROM clinic_rooms WHERE id = p_room_id;
  END IF;
  
  IF p_professional_id IS NOT NULL THEN
    SELECT full_name INTO v_professional_name FROM profiles WHERE id = p_professional_id;
  END IF;
  
  INSERT INTO patient_calls (
    tenant_id, patient_id, appointment_id, triage_id,
    room_id, room_name, professional_id, professional_name,
    priority, priority_label, call_number, status
  ) VALUES (
    p_tenant_id, p_patient_id, p_appointment_id, p_triage_id,
    p_room_id, v_room_name, p_professional_id, v_professional_name,
    p_priority, p_priority_label, v_call_number, 'waiting'
  ) RETURNING id INTO v_call_id;
  
  RETURN v_call_id;
END;
$$;

-- ─── 2. Trigger: auto_add_to_queue_on_checkin (v3 - com room_id) ───────────
-- Agora propaga room_id do agendamento para a fila, se existir.

CREATE OR REPLACE FUNCTION auto_add_to_queue_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_queue BOOLEAN;
  v_already_in_queue BOOLEAN;
  v_priority INTEGER;
  v_priority_label TEXT;
  v_call_id UUID;
  v_room_id UUID;
BEGIN
  -- Só processa se mudou para 'arrived'
  IF NEW.status::TEXT != 'arrived' OR (OLD IS NOT NULL AND OLD.status::TEXT = 'arrived') THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se tenant tem auto-queue habilitado
  SELECT auto_queue_on_checkin INTO v_auto_queue
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  IF NOT COALESCE(v_auto_queue, true) THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se já está na fila hoje
  SELECT EXISTS(
    SELECT 1 FROM patient_calls
    WHERE tenant_id = NEW.tenant_id
      AND patient_id = NEW.patient_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling', 'in_service')
  ) INTO v_already_in_queue;
  
  IF v_already_in_queue THEN
    RETURN NEW;
  END IF;
  
  -- Obtém prioridade do paciente (idade, gestante, PcD)
  BEGIN
    SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
    FROM get_patient_priority(NEW.patient_id) gpp;
  EXCEPTION WHEN OTHERS THEN
    v_priority := 5;
    v_priority_label := 'Normal';
  END;

  -- Propaga room_id do agendamento (se existir)
  v_room_id := NEW.room_id;
  
  -- Adiciona à fila (CRÍTICO - não pode falhar)
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    NULL,              -- triage_id (será preenchido depois)
    v_room_id,         -- room_id do agendamento ← FIX
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Cria notificação para o profissional (protegido contra falhas)
  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (
        user_id,
        tenant_id,
        type,
        title,
        body,
        metadata
      )
      SELECT 
        p.user_id,
        NEW.tenant_id,
        'paciente_chegou',
        'Paciente Chegou',
        c.name || ' fez check-in e está aguardando',
        jsonb_build_object(
          'patient_id', NEW.patient_id,
          'patient_name', c.name,
          'appointment_id', NEW.id,
          'call_id', v_call_id,
          'priority', v_priority,
          'priority_label', v_priority_label
        )
      FROM profiles p
      JOIN patients c ON c.id = NEW.patient_id
      WHERE p.id = NEW.professional_id
        AND p.user_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_add_to_queue_on_checkin: notification failed for appointment % - %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garante triggers (idempotente)
DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_queue_on_checkin();

DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin_insert ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- ─── 3. Trigger: atualizar fila quando triagem é salva ──────────────────────
-- Quando uma triagem é criada e vinculada a um appointment, atualiza
-- a prioridade e marca is_triaged=true no patient_calls correspondente.

CREATE OR REPLACE FUNCTION auto_update_queue_on_triage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_priority INTEGER;
  v_priority_label TEXT;
BEGIN
  -- Mapear prioridade da triagem (texto) para prioridade numérica da fila
  CASE NEW.priority
    WHEN 'emergencia' THEN v_queue_priority := 1; v_priority_label := 'Emergência';
    WHEN 'urgente' THEN v_queue_priority := 2; v_priority_label := 'Urgente';
    WHEN 'pouco_urgente' THEN v_queue_priority := 4; v_priority_label := 'Pouco Urgente';
    WHEN 'nao_urgente' THEN v_queue_priority := 5; v_priority_label := 'Normal';
    ELSE v_queue_priority := 5; v_priority_label := 'Normal';
  END CASE;

  -- Atualizar patient_calls do mesmo paciente/tenant hoje
  -- Prioriza match por appointment_id, senão por patient_id
  IF NEW.appointment_id IS NOT NULL THEN
    UPDATE patient_calls
    SET 
      is_triaged = TRUE,
      triage_priority = NEW.priority,
      triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),  -- mantém a mais urgente
      priority_label = CASE 
        WHEN v_queue_priority < priority THEN v_priority_label 
        ELSE priority_label 
      END,
      updated_at = NOW()
    WHERE appointment_id = NEW.appointment_id
      AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling');
  ELSE
    -- Sem appointment_id: busca por patient_id do dia
    UPDATE patient_calls
    SET 
      is_triaged = TRUE,
      triage_priority = NEW.priority,
      triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),
      priority_label = CASE 
        WHEN v_queue_priority < priority THEN v_priority_label 
        ELSE priority_label 
      END,
      updated_at = NOW()
    WHERE patient_id = NEW.patient_id
      AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_queue_on_triage ON triage_records;
CREATE TRIGGER trg_auto_update_queue_on_triage
  AFTER INSERT ON triage_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_queue_on_triage();

-- Também ao atualizar prioridade da triagem
DROP TRIGGER IF EXISTS trg_auto_update_queue_on_triage_update ON triage_records;
CREATE TRIGGER trg_auto_update_queue_on_triage_update
  AFTER UPDATE OF priority ON triage_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_queue_on_triage();

-- ─── 4. get_waiting_queue v2: inclui is_triaged e triage_priority ───────────

DROP FUNCTION IF EXISTS get_waiting_queue(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_waiting_queue(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
  client_name TEXT,
  call_number INTEGER,
  priority INTEGER,
  priority_label TEXT,
  room_name TEXT,
  professional_name TEXT,
  checked_in_at TIMESTAMPTZ,
  wait_time_minutes INTEGER,
  queue_position INTEGER,
  appointment_id UUID,
  service_name TEXT,
  is_triaged BOOLEAN,
  triage_priority TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.patient_id,
    c.name as client_name,
    pc.call_number,
    pc.priority,
    pc.priority_label,
    pc.room_name,
    pc.professional_name,
    pc.checked_in_at,
    EXTRACT(EPOCH FROM (NOW() - pc.checked_in_at))::INTEGER / 60 as wait_time_minutes,
    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER as queue_position,
    pc.appointment_id,
    pr.name as service_name,
    COALESCE(pc.is_triaged, FALSE) as is_triaged,
    pc.triage_priority
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  LEFT JOIN appointments a ON a.id = pc.appointment_id
  LEFT JOIN procedures pr ON pr.id = a.procedure_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT p_limit;
END;
$$;

-- ─── 5. complete_patient_service v2: sincroniza com appointment ─────────────
-- Quando o atendimento na fila é concluído, marca a triagem como concluída
-- também, fechando o ciclo.

CREATE OR REPLACE FUNCTION complete_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_triage_id UUID;
BEGIN
  -- Marca o patient_call como completed
  UPDATE patient_calls
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id
  RETURNING triage_id INTO v_triage_id;

  -- Se tem triagem vinculada, marca como concluída
  IF v_triage_id IS NOT NULL THEN
    UPDATE triage_records
    SET status = 'concluida'
    WHERE id = v_triage_id
      AND status != 'concluida';
  END IF;
END;
$$;

-- ─── 6. Índice para busca rápida de is_triaged ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_patient_calls_triaged
  ON patient_calls(tenant_id, is_triaged, created_at)
  WHERE status = 'waiting';
