-- ============================================================================
-- FASE 33A: Integração Check-in → Fila Automática
-- Quando paciente faz check-in (status arrived), adiciona à fila automaticamente
-- ============================================================================

-- ─── 0. Adicionar valor 'arrived' ao enum appointment_status ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'arrived' 
    AND enumtypid = 'appointment_status'::regtype
  ) THEN
    ALTER TYPE appointment_status ADD VALUE 'arrived' AFTER 'confirmed';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1. Configuração por tenant ─────────────────────────────────────────────

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS auto_queue_on_checkin BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN tenants.auto_queue_on_checkin IS 'Se true, adiciona paciente à fila automaticamente ao fazer check-in';

-- ─── 2. Função para determinar prioridade do paciente ───────────────────────

CREATE OR REPLACE FUNCTION get_patient_priority(p_client_id UUID)
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
  -- Busca dados do cliente
  SELECT 
    COALESCE(c.date_of_birth, c.birth_date),
    LOWER(COALESCE(c.notes, '')) LIKE '%gestante%' OR LOWER(COALESCE(c.notes, '')) LIKE '%grávida%',
    LOWER(COALESCE(c.notes, '')) LIKE '%pcd%' OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiente%' OR LOWER(COALESCE(c.notes, '')) LIKE '%cadeirante%',
    c.notes
  INTO v_birth_date, v_is_pregnant, v_is_pcd, v_notes
  FROM clients c
  WHERE c.id = p_client_id;
  
  -- Calcula idade
  IF v_birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));
  ELSE
    v_age := NULL;
  END IF;
  
  -- Determina prioridade (1 = mais urgente, 5 = normal)
  -- Prioridade 2: Idosos (>= 60), Gestantes, PCD
  -- Prioridade 3: Idosos (>= 80) - super idosos
  -- Prioridade 5: Normal
  
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

-- ─── 3. Função para adicionar à fila no check-in ────────────────────────────

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
  -- Só processa se mudou para 'arrived' (usando ::TEXT para evitar problema com enum)
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
      AND client_id = NEW.client_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling', 'in_service')
  ) INTO v_already_in_queue;
  
  IF v_already_in_queue THEN
    RETURN NEW;
  END IF;
  
  -- Obtém prioridade do paciente
  SELECT priority, priority_label INTO v_priority, v_priority_label
  FROM get_patient_priority(NEW.client_id);
  
  -- Adiciona à fila
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.client_id,
    NEW.id,  -- appointment_id
    NULL,    -- triage_id
    NULL,    -- room_id (será definido na chamada)
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Cria notificação para o profissional (se definido)
  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      tenant_id,
      type,
      title,
      message,
      data
    )
    SELECT 
      p.user_id,
      NEW.tenant_id,
      'paciente_chegou',
      'Paciente Chegou',
      c.name || ' fez check-in e está aguardando',
      jsonb_build_object(
        'client_id', NEW.client_id,
        'client_name', c.name,
        'appointment_id', NEW.id,
        'call_id', v_call_id,
        'priority', v_priority,
        'priority_label', v_priority_label
      )
    FROM profiles p
    JOIN clients c ON c.id = NEW.client_id
    WHERE p.id = NEW.professional_id
      AND p.user_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ─── 4. Trigger no appointments ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- Também para INSERT (caso já venha com status arrived)
-- A função auto_add_to_queue_on_checkin já verifica se status = 'arrived'
DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin_insert ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- ─── 5. Atualizar RPC get_waiting_queue para incluir mais dados ─────────────

DROP FUNCTION IF EXISTS get_waiting_queue(UUID, INTEGER);

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
  queue_position INTEGER,
  appointment_id UUID,
  service_name TEXT
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
    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER as queue_position,
    pc.appointment_id,
    s.name as service_name
  FROM patient_calls pc
  JOIN clients c ON c.id = pc.client_id
  LEFT JOIN appointments a ON a.id = pc.appointment_id
  LEFT JOIN services s ON s.id = a.service_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT p_limit;
END;
$$;

-- ─── 6. RPC para buscar configuração de auto-queue ──────────────────────────

CREATE OR REPLACE FUNCTION get_tenant_queue_settings(p_tenant_id UUID)
RETURNS TABLE (
  auto_queue_on_checkin BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT t.auto_queue_on_checkin
  FROM tenants t
  WHERE t.id = p_tenant_id;
END;
$$;

-- ─── 7. RPC para atualizar configuração ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_tenant_queue_settings(
  p_tenant_id UUID,
  p_auto_queue_on_checkin BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verifica se é admin
  IF NOT is_tenant_admin(auth.uid(), p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar configurações';
  END IF;
  
  UPDATE tenants
  SET auto_queue_on_checkin = p_auto_queue_on_checkin
  WHERE id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_queue_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_queue_settings(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_priority(UUID) TO authenticated;

-- ─── 8. Comentários ─────────────────────────────────────────────────────────

COMMENT ON FUNCTION auto_add_to_queue_on_checkin IS 'Trigger que adiciona paciente à fila automaticamente ao fazer check-in';
COMMENT ON FUNCTION get_patient_priority IS 'Retorna prioridade do paciente baseado em idade, gestante, PCD';
