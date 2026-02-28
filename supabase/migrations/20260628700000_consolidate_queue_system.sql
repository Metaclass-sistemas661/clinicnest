-- ============================================================================
-- CONSOLIDAÇÃO DEFINITIVA: Sistema de Fila de Pacientes
-- ============================================================================
-- 
-- Esta migration é IDEMPOTENTE e autossuficiente.
-- Ela DROP + CREATE TODAS as funções de fila com a versão final correta.
-- Resolve problemas de:
--   - GRANTs faltantes (PostgREST retorna erro silencioso sem GRANT)
--   - Parâmetros renomeados (p_client_id → p_patient_id) 
--   - Tabela rooms → clinic_rooms
--   - Colunas de notificação (message/data → body/metadata)
--   - Exception handling no trigger
--   - Colunas is_triaged/triage_priority em patient_calls
--
-- FUNCIONES DEFINIDAS:
--   1.  generate_call_number(UUID) → INTEGER
--   2.  get_patient_priority(UUID) → TABLE
--   3.  add_patient_to_queue(8 params) → UUID
--   4.  auto_add_to_queue_on_checkin() → TRIGGER
--   5.  auto_update_queue_on_triage() → TRIGGER
--   6.  get_waiting_queue(UUID, INTEGER) → TABLE
--   7.  get_current_call(UUID) → TABLE
--   8.  get_queue_statistics(UUID) → TABLE
--   9.  call_next_patient(UUID, UUID, UUID) → TABLE
--   10. recall_patient(UUID) → VOID
--   11. start_patient_service(UUID) → VOID
--   12. complete_patient_service(UUID) → VOID
--   13. mark_patient_no_show(UUID) → VOID
-- ============================================================================

-- ─── 0. Colunas auxiliares (idempotente) ────────────────────────────────────

ALTER TABLE public.patient_calls
  ADD COLUMN IF NOT EXISTS is_triaged BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.patient_calls
  ADD COLUMN IF NOT EXISTS triage_priority TEXT;

-- Coluna auto_queue_on_checkin em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auto_queue_on_checkin BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 1. generate_call_number ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_call_number(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
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

-- ─── 2. get_patient_priority ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_patient_priority(UUID);

CREATE FUNCTION public.get_patient_priority(p_patient_id UUID)
RETURNS TABLE (priority INTEGER, priority_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_birth_date DATE;
  v_age INTEGER;
  v_is_pregnant BOOLEAN;
  v_is_pcd BOOLEAN;
BEGIN
  SELECT 
    COALESCE(c.date_of_birth, c.birth_date),
    LOWER(COALESCE(c.notes, '')) LIKE '%gestante%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%grávida%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%gravida%',
    LOWER(COALESCE(c.notes, '')) LIKE '%pcd%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiente%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%cadeirante%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiência%'
  INTO v_birth_date, v_is_pregnant, v_is_pcd
  FROM patients c
  WHERE c.id = p_patient_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
    RETURN;
  END IF;
  
  IF v_birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));
  END IF;
  
  -- Prioridades (Estatuto do Idoso / Lei 10.048):
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

-- ─── 3. add_patient_to_queue ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT);

CREATE FUNCTION public.add_patient_to_queue(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_triage_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_priority_label TEXT DEFAULT 'Normal'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID;
  v_existing_id UUID;
  v_call_number INTEGER;
  v_room_name TEXT;
  v_professional_name TEXT;
BEGIN
  -- Idempotente: se já está na fila hoje, retorna ID existente
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

-- ─── 4. auto_add_to_queue_on_checkin (TRIGGER) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_add_to_queue_on_checkin()
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
  
  -- Verifica flag do tenant
  SELECT auto_queue_on_checkin INTO v_auto_queue
  FROM tenants WHERE id = NEW.tenant_id;
  
  IF NOT COALESCE(v_auto_queue, true) THEN
    RETURN NEW;
  END IF;
  
  -- Verifica duplicata
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
  
  -- Prioridade (protegido)
  BEGIN
    SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
    FROM get_patient_priority(NEW.patient_id) gpp;
  EXCEPTION WHEN OTHERS THEN
    v_priority := 5;
    v_priority_label := 'Normal';
  END;
  
  -- Adiciona à fila (CRÍTICO)
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    NULL,
    NEW.room_id,
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Notificação (protegida — falha NÃO impede entrada na fila)
  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, metadata)
      SELECT 
        p.user_id, NEW.tenant_id, 'paciente_chegou', 'Paciente Chegou',
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
      WHERE p.id = NEW.professional_id AND p.user_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_add_to_queue_on_checkin: notify failed for apt % - %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Triggers (idempotente)
DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();

DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin_insert ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin_insert
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- ─── 5. auto_update_queue_on_triage (TRIGGER) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_update_queue_on_triage()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_queue_priority INTEGER;
  v_priority_label TEXT;
BEGIN
  CASE NEW.priority
    WHEN 'emergencia' THEN v_queue_priority := 1; v_priority_label := 'Emergência';
    WHEN 'urgente' THEN v_queue_priority := 2; v_priority_label := 'Urgente';
    WHEN 'pouco_urgente' THEN v_queue_priority := 4; v_priority_label := 'Pouco Urgente';
    WHEN 'nao_urgente' THEN v_queue_priority := 5; v_priority_label := 'Normal';
    ELSE v_queue_priority := 5; v_priority_label := 'Normal';
  END CASE;

  IF NEW.appointment_id IS NOT NULL THEN
    UPDATE patient_calls SET 
      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),
      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,
      updated_at = NOW()
    WHERE appointment_id = NEW.appointment_id AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');
  ELSE
    UPDATE patient_calls SET 
      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),
      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,
      updated_at = NOW()
    WHERE patient_id = NEW.patient_id AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_queue_on_triage ON triage_records;
CREATE TRIGGER trg_auto_update_queue_on_triage
  AFTER INSERT ON triage_records FOR EACH ROW EXECUTE FUNCTION auto_update_queue_on_triage();

DROP TRIGGER IF EXISTS trg_auto_update_queue_on_triage_update ON triage_records;
CREATE TRIGGER trg_auto_update_queue_on_triage_update
  AFTER UPDATE OF priority ON triage_records FOR EACH ROW EXECUTE FUNCTION auto_update_queue_on_triage();

-- ─── 6. get_waiting_queue ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_waiting_queue(UUID, INTEGER);

CREATE FUNCTION public.get_waiting_queue(
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
    pc.id, pc.patient_id, c.name, pc.call_number, pc.priority, pc.priority_label,
    pc.room_name, pc.professional_name, pc.checked_in_at,
    EXTRACT(EPOCH FROM (NOW() - pc.checked_in_at))::INTEGER / 60,
    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER,
    pc.appointment_id, pr.name,
    COALESCE(pc.is_triaged, FALSE), pc.triage_priority
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

-- ─── 7. get_current_call ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_current_call(UUID);

CREATE FUNCTION public.get_current_call(p_tenant_id UUID)
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
    pc.id, pc.patient_id, c.name, pc.call_number,
    pc.room_name, pc.professional_name, pc.times_called, pc.last_called_at,
    pc.priority, pc.priority_label
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'calling'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.last_called_at DESC
  LIMIT 1;
END;
$$;

-- ─── 8. get_queue_statistics ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_queue_statistics(UUID);

CREATE FUNCTION public.get_queue_statistics(p_tenant_id UUID)
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
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'waiting')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'calling')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'in_service')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'completed')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'no_show')::INTEGER,
    ROUND(AVG(
      CASE WHEN pc.first_called_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (pc.first_called_at - pc.checked_in_at)) / 60 
      END
    )::NUMERIC, 1)
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.created_at::DATE = CURRENT_DATE;
END;
$$;

-- ─── 9. call_next_patient ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.call_next_patient(UUID, UUID, UUID);

CREATE FUNCTION public.call_next_patient(
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

  SELECT pc.id INTO v_call_id
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
    AND (p_room_id IS NULL OR pc.room_id = p_room_id OR pc.room_id IS NULL)
    AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id OR pc.professional_id IS NULL)
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT 1;
  
  IF v_call_id IS NULL THEN RETURN; END IF;
  
  UPDATE patient_calls SET 
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
  SELECT pc.id, pc.patient_id, c.name, pc.room_name, pc.professional_name,
    pc.call_number, pc.priority, pc.priority_label
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.id = v_call_id;
END;
$$;

-- ─── 10. recall_patient ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recall_patient(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    times_called = times_called + 1,
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id AND status = 'calling';
END;
$$;

-- ─── 11. start_patient_service ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    status = 'in_service',
    started_service_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id AND status = 'calling';
END;
$$;

-- ─── 12. complete_patient_service ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_triage_id UUID;
BEGIN
  UPDATE patient_calls SET 
    status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_call_id
  RETURNING triage_id INTO v_triage_id;

  IF v_triage_id IS NOT NULL THEN
    UPDATE triage_records SET status = 'concluida'
    WHERE id = v_triage_id AND status != 'concluida';
  END IF;
END;
$$;

-- ─── 13. mark_patient_no_show ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_patient_no_show(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    status = 'no_show', updated_at = NOW()
  WHERE id = p_call_id AND status IN ('waiting', 'calling');
END;
$$;

-- ─── 14. Configuração de fila por tenant ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_tenant_queue_settings(p_tenant_id UUID)
RETURNS TABLE (auto_queue_on_checkin BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT t.auto_queue_on_checkin FROM tenants t WHERE t.id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_queue_settings(
  p_tenant_id UUID, p_auto_queue_on_checkin BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_tenant_admin(auth.uid(), p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar configurações';
  END IF;
  UPDATE tenants SET auto_queue_on_checkin = p_auto_queue_on_checkin WHERE id = p_tenant_id;
END;
$$;

-- ─── 15. GRANTS (OBRIGATÓRIO para PostgREST/Supabase Client) ───────────────
-- Sem GRANT, o role "authenticated" não pode chamar RPCs via supabase.rpc()

GRANT EXECUTE ON FUNCTION public.generate_call_number(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_priority(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_waiting_queue(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_call(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_queue_statistics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.call_next_patient(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recall_patient(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_patient_service(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_patient_service(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_patient_no_show(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_queue_settings(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_queue_settings(UUID, BOOLEAN) TO authenticated, service_role;

-- ─── 16. Índices (idempotente) ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_patient_calls_waiting
  ON patient_calls(tenant_id, priority, checked_in_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_patient_calls_triaged
  ON patient_calls(tenant_id, is_triaged, created_at)
  WHERE status = 'waiting';

-- ─── 17. RLS (idempotente) ──────────────────────────────────────────────────

ALTER TABLE patient_calls ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "patient_calls_tenant_isolation" ON patient_calls
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FIM - Sistema de fila completo e funcional
-- ============================================================================
