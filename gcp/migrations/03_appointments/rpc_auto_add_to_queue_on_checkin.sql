CREATE OR REPLACE FUNCTION public.auto_add_to_queue_on_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_auto_queue BOOLEAN;

  v_already_in_queue BOOLEAN;

  v_priority INTEGER;

  v_priority_label TEXT;

  v_call_id UUID;

BEGIN

  -- S├│ processa se mudou para 'arrived'

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

  

  -- Adiciona ├á fila (CR├ìTICO)

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

  

  -- Notifica├º├úo (protegida ÔÇö falha N├âO impede entrada na fila)

  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN

    BEGIN

      INSERT INTO notifications (user_id, tenant_id, type, title, body, metadata)

      SELECT 

        p.user_id, NEW.tenant_id, 'paciente_chegou', 'Paciente Chegou',

        c.name || ' fez check-in e est├í aguardando',

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

$function$;