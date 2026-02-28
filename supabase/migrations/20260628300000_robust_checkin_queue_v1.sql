-- ============================================================================
-- FIX: Consolidação robusta do fluxo check-in → fila de espera
-- ============================================================================
-- Problemas resolvidos:
-- 1. Trigger auto_add_to_queue_on_checkin usava message/data (colunas erradas)
-- 2. A falha no INSERT de notificações causava ROLLBACK total → paciente
--    NÃO entrava na fila e NÃO ficava com status 'arrived'
-- 3. Adicionado tratamento de erros para que falha na notificação
--    NÃO impeça a adição à fila (CRITICAL FIX)
-- 4. get_queue_statistics retorna avg_wait_time_minutes para os frontends
-- ============================================================================

-- ─── 1. TRIGGER: auto_add_to_queue_on_checkin (versão robusta) ──────────────
-- A notificação agora é protected com BEGIN/EXCEPTION para que uma falha
-- no INSERT de notificações NÃO reverta a adição à fila.

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
  
  -- Obtém prioridade do paciente
  BEGIN
    SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
    FROM get_patient_priority(NEW.patient_id) gpp;
  EXCEPTION WHEN OTHERS THEN
    v_priority := 5;
    v_priority_label := 'Normal';
  END;
  
  -- Adiciona à fila (CRÍTICO - não pode falhar)
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    NULL,
    NULL,
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Cria notificação para o profissional (protegido contra falhas)
  -- Se a notificação falhar, o paciente AINDA fica na fila
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
      -- Log silencioso: falha na notificação não deve impedir check-in
      RAISE WARNING 'auto_add_to_queue_on_checkin: notification failed for appointment % - %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garante triggers
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

-- ─── 2. get_patient_priority (versão robusta) ───────────────────────────────
-- Lida com campos opcionais e paciente não encontrado graciosamente.

DROP FUNCTION IF EXISTS get_patient_priority(UUID);

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
  
  -- Se paciente não encontrado, retorna prioridade normal
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
    RETURN;
  END IF;
  
  IF v_birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));
  ELSE
    v_age := NULL;
  END IF;
  
  -- Prioridades (conforme Estatuto do Idoso e Lei 10.048/2000):
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

-- ─── 3. add_patient_to_queue (versão robusta) ───────────────────────────────
-- Protegido contra inserção duplicada (ON CONFLICT).

DROP FUNCTION IF EXISTS add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT);

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

-- ─── 4. get_waiting_queue (com nome do procedimento) ────────────────────────
-- Retorna service_name do agendamento para exibição na fila.

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
  service_name TEXT
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
    pr.name as service_name
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

-- ─── 5. get_current_call (com prioridade) ───────────────────────────────────

DROP FUNCTION IF EXISTS get_current_call(UUID);

CREATE OR REPLACE FUNCTION get_current_call(p_tenant_id UUID)
RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
  client_name TEXT,
  call_number INTEGER,
  room_name TEXT,
  professional_name TEXT,
  times_called INTEGER,
  last_called_at TIMESTAMPTZ,
  priority INTEGER,
  priority_label TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.patient_id,
    c.name as client_name,
    pc.call_number,
    pc.room_name,
    pc.professional_name,
    pc.times_called,
    pc.last_called_at,
    pc.priority,
    pc.priority_label
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'calling'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.last_called_at DESC
  LIMIT 1;
END;
$$;

-- ─── 6. get_queue_statistics (campo consistente) ────────────────────────────

DROP FUNCTION IF EXISTS get_queue_statistics(UUID);

CREATE OR REPLACE FUNCTION get_queue_statistics(p_tenant_id UUID)
RETURNS TABLE (
  total_today INTEGER,
  waiting_count INTEGER,
  calling_count INTEGER,
  in_service_count INTEGER,
  completed_count INTEGER,
  no_show_count INTEGER,
  avg_wait_time_minutes NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_today,
    COUNT(*) FILTER (WHERE pc.status = 'waiting')::INTEGER as waiting_count,
    COUNT(*) FILTER (WHERE pc.status = 'calling')::INTEGER as calling_count,
    COUNT(*) FILTER (WHERE pc.status = 'in_service')::INTEGER as in_service_count,
    COUNT(*) FILTER (WHERE pc.status = 'completed')::INTEGER as completed_count,
    COUNT(*) FILTER (WHERE pc.status = 'no_show')::INTEGER as no_show_count,
    ROUND(AVG(
      CASE WHEN pc.first_called_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (pc.first_called_at - pc.checked_in_at)) / 60 
      END
    )::NUMERIC, 1) as avg_wait_time_minutes
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.created_at::DATE = CURRENT_DATE;
END;
$$;

-- ─── 7. call_next_patient (com prioridade no retorno) ───────────────────────

DROP FUNCTION IF EXISTS call_next_patient(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION call_next_patient(
  p_tenant_id UUID,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL
) RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
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
  IF p_room_id IS NOT NULL THEN
    SELECT r.name INTO v_room_name FROM clinic_rooms r WHERE r.id = p_room_id;
  END IF;
  
  IF p_professional_id IS NOT NULL THEN
    SELECT pr.full_name INTO v_professional_name FROM profiles pr WHERE pr.id = p_professional_id;
  END IF;

  -- Seleciona próximo por prioridade + ordem de chegada
  SELECT pc.id INTO v_call_id
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
    AND (p_room_id IS NULL OR pc.room_id = p_room_id OR pc.room_id IS NULL)
    AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id OR pc.professional_id IS NULL)
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT 1;
  
  IF v_call_id IS NULL THEN
    RETURN;
  END IF;
  
  UPDATE patient_calls
  SET 
    status = 'calling',
    room_id = COALESCE(p_room_id, patient_calls.room_id),
    room_name = COALESCE(v_room_name, patient_calls.room_name),
    professional_id = COALESCE(p_professional_id, patient_calls.professional_id),
    professional_name = COALESCE(v_professional_name, patient_calls.professional_name),
    times_called = times_called + 1,
    first_called_at = COALESCE(first_called_at, NOW()),
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE patient_calls.id = v_call_id;
  
  RETURN QUERY
  SELECT 
    pc.id as call_id,
    pc.patient_id,
    c.name as client_name,
    pc.room_name,
    pc.professional_name,
    pc.call_number,
    pc.priority,
    pc.priority_label
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.id = v_call_id;
END;
$$;
