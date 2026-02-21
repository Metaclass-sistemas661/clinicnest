-- ============================================================
-- Patient Notifications v1
-- Tabela dedicada para notificações do portal do paciente.
-- Triggers automáticos ao criar atestados, receitas e exames.
-- ============================================================

-- ─── Tabela ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  metadata   JSONB DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_notif_user
  ON public.patient_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_notif_unread
  ON public.patient_notifications(user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notifications FORCE ROW LEVEL SECURITY;

-- Paciente lê apenas suas próprias notificações
CREATE POLICY patient_notifications_select ON public.patient_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Paciente pode marcar como lida (update read_at)
CREATE POLICY patient_notifications_update ON public.patient_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff do tenant pode inserir notificações para pacientes
CREATE POLICY patient_notifications_insert_staff ON public.patient_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_notifications;

-- ─── Trigger Function: notificar paciente ───────────────────
-- Genérica: recebe client_id + tenant_id e dados da notificação
CREATE OR REPLACE FUNCTION public.notify_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient record;
  v_type text;
  v_title text;
  v_body text;
  v_prof_name text;
  v_clinic_name text;
  v_metadata jsonb;
BEGIN
  -- Buscar todos os pacientes vinculados a este client_id + tenant_id
  FOR v_patient IN
    SELECT pp.user_id
    FROM public.patient_profiles pp
    WHERE pp.client_id = NEW.client_id
      AND pp.tenant_id = NEW.tenant_id
      AND pp.is_active = true
  LOOP
    -- Buscar nome do profissional (se houver)
    v_prof_name := '';
    IF TG_TABLE_NAME = 'exam_results' THEN
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.requested_by;
    ELSE
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.professional_id;
    END IF;

    -- Buscar nome da clínica
    SELECT COALESCE(t.name, '') INTO v_clinic_name
    FROM public.tenants t WHERE t.id = NEW.tenant_id;

    -- Definir tipo, título e corpo conforme a tabela de origem
    IF TG_TABLE_NAME = 'medical_certificates' THEN
      v_type := 'certificate_released';
      v_title := 'Novo atestado disponível';
      v_body := format('O Dr(a). %s emitiu um %s para você.',
        v_prof_name,
        CASE NEW.certificate_type
          WHEN 'atestado' THEN 'atestado médico'
          WHEN 'declaracao_comparecimento' THEN 'declaração de comparecimento'
          WHEN 'laudo' THEN 'laudo médico'
          WHEN 'relatorio' THEN 'relatório médico'
          ELSE 'documento médico'
        END
      );
      v_metadata := jsonb_build_object(
        'certificate_id', NEW.id,
        'certificate_type', NEW.certificate_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'prescriptions' THEN
      v_type := 'prescription_released';
      v_title := 'Nova receita disponível';
      v_body := format('O Dr(a). %s emitiu uma receita %s para você.',
        v_prof_name,
        CASE NEW.prescription_type
          WHEN 'simples' THEN 'simples'
          WHEN 'especial_b' THEN 'especial B'
          WHEN 'especial_a' THEN 'especial A'
          WHEN 'antimicrobiano' THEN 'de antimicrobiano'
          ELSE ''
        END
      );
      v_metadata := jsonb_build_object(
        'prescription_id', NEW.id,
        'prescription_type', NEW.prescription_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'exam_results' THEN
      v_type := 'exam_released';
      v_title := 'Novo resultado de exame disponível';
      v_body := format('O resultado do exame "%s" já está disponível.', COALESCE(NEW.exam_name, 'Exame'));
      v_metadata := jsonb_build_object(
        'exam_id', NEW.id,
        'exam_name', NEW.exam_name,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );
    END IF;

    INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
    VALUES (v_patient.user_id, v_type, v_title, v_body, v_metadata);
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─── Triggers ───────────────────────────────────────────────

CREATE TRIGGER trg_notify_patient_certificate
  AFTER INSERT ON public.medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();

CREATE TRIGGER trg_notify_patient_prescription
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();

CREATE TRIGGER trg_notify_patient_exam
  AFTER INSERT ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();
