-- ============================================================================
-- FIX: Unificar referências de salas para clinic_rooms
-- ============================================================================
-- Problema: Existem duas tabelas de salas:
--   1. "rooms" (legada, criada em medical_tables_v1) - simples, sem dados reais
--   2. "clinic_rooms" (nova, criada em nursing_evolutions_rooms_v1) - usada pela UI
--
-- O GestaoSalas.tsx grava em clinic_rooms, mas:
--   - patient_calls.room_id referencia rooms (legada)
--   - appointments.room_id referencia rooms (legada)
--   - Funções SQL (call_next_patient, add_patient_to_queue) consulta rooms
--   - useRooms.ts consultava rooms (já corrigido no frontend)
--
-- Solução: Migrar FKs e funções para usar clinic_rooms
-- ============================================================================

-- ─── 1. Migrar FK de patient_calls.room_id ──────────────────────────────────

DO $$
BEGIN
  -- Dropar FK antiga que referencia rooms
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'patient_calls'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%room_id%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE patient_calls DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'patient_calls'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%room_id%'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'patient_calls FK drop skipped: %', SQLERRM;
END;
$$;

-- Não adicionamos FK nova apontando para clinic_rooms porque room_id em
-- patient_calls armazena o room_id passado no momento da chamada, que pode
-- ser NULL e não precisa de integridade referencial estrita.
-- O nome da sala já é denormalizado em room_name.

-- ─── 2. Migrar FK de appointments.room_id ───────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'appointments'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'room_id'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE appointments DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'appointments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'room_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'appointments FK drop skipped: %', SQLERRM;
END;
$$;

-- Adicionar nova FK apontando para clinic_rooms
DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES public.clinic_rooms(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'appointments_room_id_fkey already exists';
WHEN OTHERS THEN
  RAISE NOTICE 'appointments FK add skipped: %', SQLERRM;
END;
$$;

-- ─── 3. Recriar add_patient_to_queue usando clinic_rooms ────────────────────

CREATE OR REPLACE FUNCTION add_patient_to_queue(
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

-- ─── 4. Recriar call_next_patient usando clinic_rooms ───────────────────────

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
