-- ============================================================
-- APLICAR NO SUPABASE SQL EDITOR
-- Migration: Waitlist auto-notify on appointment cancellation
-- ============================================================
-- Esta migration cria:
-- 1. Tabela waitlist_notifications (fila de notificações pendentes)
-- 2. Função notify_waitlist_on_cancellation() (busca waitlist compatível)
-- 3. Trigger trg_notify_waitlist_on_cancel no appointments (dispara ao cancelar)
-- ============================================================

-- 1. Tabela de fila de notificações de waitlist
CREATE TABLE IF NOT EXISTS public.waitlist_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  waitlist_id      uuid NOT NULL REFERENCES public.waitlist(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL,
  appointment_date timestamptz NOT NULL,
  service_id       uuid,
  professional_id  uuid,
  period           text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_notifications_tenant_policy ON public.waitlist_notifications
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_pending
  ON public.waitlist_notifications (tenant_id, status, created_at)
  WHERE status = 'pending';

-- 2. Função trigger
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_at     timestamptz;
  v_service_id       uuid;
  v_professional_id  uuid;
  v_tenant_id        uuid;
  v_cancelled_period text;
  v_hour             int;
  v_entry            record;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_cancelled_at    := NEW.scheduled_at;
  v_service_id      := NEW.service_id;
  v_professional_id := NEW.professional_id;
  v_tenant_id       := NEW.tenant_id;

  v_hour := EXTRACT(HOUR FROM v_cancelled_at AT TIME ZONE 'America/Sao_Paulo');
  IF v_hour < 12 THEN
    v_cancelled_period := 'manha';
  ELSIF v_hour < 18 THEN
    v_cancelled_period := 'tarde';
  ELSE
    v_cancelled_period := 'noite';
  END IF;

  FOR v_entry IN
    SELECT w.id, w.patient_id
    FROM waitlist w
    WHERE w.tenant_id = v_tenant_id
      AND w.status = 'aguardando'
      AND (w.service_id IS NULL OR w.service_id = v_service_id)
      AND (w.professional_id IS NULL OR w.professional_id = v_professional_id)
      AND (
        w.preferred_periods IS NULL
        OR cardinality(w.preferred_periods) = 0
        OR v_cancelled_period = ANY(w.preferred_periods)
      )
    ORDER BY
      CASE w.priority
        WHEN 'urgente' THEN 1
        WHEN 'alta'    THEN 2
        ELSE 3
      END,
      w.created_at ASC
    LIMIT 3
  LOOP
    UPDATE waitlist
    SET status = 'notificado',
        notified_at = NOW(),
        updated_at = NOW()
    WHERE id = v_entry.id;

    INSERT INTO notifications (
      user_id, tenant_id, type, title, message, metadata
    )
    SELECT
      pp.user_id,
      v_tenant_id,
      'waitlist_slot_available',
      'Vaga disponível!',
      'Uma vaga ficou disponível para o serviço que você aguardava. Acesse o app para agendar.',
      jsonb_build_object(
        'waitlist_id', v_entry.id,
        'appointment_date', v_cancelled_at::text,
        'service_id', v_service_id,
        'professional_id', v_professional_id,
        'period', v_cancelled_period
      )
    FROM patient_profiles pp
    WHERE pp.patient_id = v_entry.patient_id
    LIMIT 1;

    INSERT INTO waitlist_notifications (
      tenant_id, waitlist_id, patient_id, appointment_date,
      service_id, professional_id, period, status
    ) VALUES (
      v_tenant_id, v_entry.id, v_entry.patient_id, v_cancelled_at,
      v_service_id, v_professional_id, v_cancelled_period, 'pending'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_notify_waitlist_on_cancel ON public.appointments;
CREATE TRIGGER trg_notify_waitlist_on_cancel
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.notify_waitlist_on_cancellation();

-- 4. Grants
GRANT EXECUTE ON FUNCTION public.notify_waitlist_on_cancellation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_waitlist_on_cancellation() TO service_role;

-- ✅ Aplicado com sucesso!
SELECT 'Migration waitlist_auto_notify_on_cancel aplicada com sucesso' AS resultado;
