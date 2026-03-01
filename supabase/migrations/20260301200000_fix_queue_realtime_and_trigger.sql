-- ============================================================================
-- FIX: patient_calls na publicação realtime + trigger protegido
-- ============================================================================
-- Problemas corrigidos:
-- 1. patient_calls NUNCA foi adicionada ao supabase_realtime → 
--    useQueueRealtime() recebia 0 eventos (subscription no-op)
-- 2. Trigger auto_add_to_queue_on_checkin: se add_patient_to_queue falhar,
--    toda a transação falha (UPDATE appointments é revertido).
--    Agora protegido com EXCEPTION handler.
-- ============================================================================

-- ─── 1. Adicionar patient_calls à publicação realtime ───────────────────────
-- Sem isso, o Supabase Realtime não emite eventos para esta tabela.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_calls;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- já está na publicação
END $$;

-- ─── 2. Trigger protegido: add_patient_to_queue com EXCEPTION handler ──────
-- Se add_patient_to_queue falhar, o check-in (UPDATE appointments) ainda
-- acontece. A fila é adicionada via fallback no frontend.

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
  
  -- Prioridade (protegido contra falhas)
  BEGIN
    SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
    FROM get_patient_priority(NEW.patient_id) gpp;
  EXCEPTION WHEN OTHERS THEN
    v_priority := 5;
    v_priority_label := 'Normal';
  END;
  
  -- Adiciona à fila (PROTEGIDO — falha NÃO deve impedir o check-in)
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_add_to_queue_on_checkin: add_patient_to_queue failed for apt % - %', NEW.id, SQLERRM;
    RETURN NEW; -- Check-in segue mesmo se a fila falhou
  END;
  
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

-- Triggers (idempotente — recria para garantir versão correta)
DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();

DROP TRIGGER IF EXISTS trg_auto_queue_on_checkin_insert ON appointments;
CREATE TRIGGER trg_auto_queue_on_checkin_insert
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();
