-- ============================================================================
-- FASE 2: Check-in Online + Questionário Pré-Consulta + Confirmação Inteligente
-- ============================================================================

-- ─── 1. Settings de confirmação escalonada no tenant ────────────────────────

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS smart_confirmation_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_confirmation_4h_channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (smart_confirmation_4h_channel IN ('whatsapp', 'email', 'sms')),
ADD COLUMN IF NOT EXISTS smart_confirmation_1h_channel TEXT NOT NULL DEFAULT 'sms'
  CHECK (smart_confirmation_1h_channel IN ('whatsapp', 'email', 'sms')),
ADD COLUMN IF NOT EXISTS smart_confirmation_autorelease_minutes INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS pre_consultation_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants.smart_confirmation_enabled IS 'Habilita confirmação escalonada (4h→1h→auto-libera)';
COMMENT ON COLUMN tenants.smart_confirmation_4h_channel IS 'Canal para lembrete 4h antes';
COMMENT ON COLUMN tenants.smart_confirmation_1h_channel IS 'Canal para lembrete 1h antes (fallback)';
COMMENT ON COLUMN tenants.smart_confirmation_autorelease_minutes IS 'Minutos antes para auto-liberar vaga se não confirmou';
COMMENT ON COLUMN tenants.pre_consultation_enabled IS 'Habilita questionário pré-consulta para pacientes';

-- ─── 2. Colunas de confirmação no appointments ─────────────────────────────

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS confirmation_sent_4h BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_sent_1h BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_auto_released BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkin_method TEXT CHECK (checkin_method IN ('online', 'reception', 'qrcode'));

COMMENT ON COLUMN appointments.confirmation_sent_4h IS 'Se o lembrete de 4h antes foi enviado';
COMMENT ON COLUMN appointments.confirmation_sent_1h IS 'Se o lembrete de 1h antes foi enviado';
COMMENT ON COLUMN appointments.confirmation_auto_released IS 'Se a vaga foi auto-liberada por falta de confirmação';
COMMENT ON COLUMN appointments.checkin_at IS 'Horário do check-in online ou presencial';
COMMENT ON COLUMN appointments.checkin_method IS 'Como o paciente fez check-in';

CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_pending
  ON appointments (tenant_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed') AND confirmed_at IS NULL;

-- ─── 3. Formulários de pré-consulta (configuráveis por tenant+serviço) ──────

CREATE TABLE IF NOT EXISTS public.pre_consultation_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES procedures(id) ON DELETE SET NULL,
  name        text NOT NULL,
  description text,
  fields      jsonb NOT NULL DEFAULT '[]',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE pre_consultation_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY pre_consultation_forms_tenant ON pre_consultation_forms
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

COMMENT ON TABLE pre_consultation_forms IS 'Formulários pré-consulta configuráveis por serviço';
COMMENT ON COLUMN pre_consultation_forms.fields IS 'JSON array: [{id, type, label, required, options?}]. type: text|textarea|select|checkbox|number|date';

-- ─── 4. Respostas dos pacientes ao questionário ────────────────────────────

CREATE TABLE IF NOT EXISTS public.pre_consultation_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  form_id         uuid NOT NULL REFERENCES pre_consultation_forms(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL,
  responses       jsonb NOT NULL DEFAULT '{}',
  submitted_at    timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE pre_consultation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY pre_consultation_responses_tenant ON pre_consultation_responses
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pre_consultation_responses_appointment
  ON pre_consultation_responses (appointment_id);

COMMENT ON TABLE pre_consultation_responses IS 'Respostas do paciente ao questionário pré-consulta';

-- ─── 5. RPC: Paciente busca formulário de pré-consulta da consulta ─────────

CREATE OR REPLACE FUNCTION public.get_preconsultation_form_for_appointment(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_service_id  uuid;
  v_form        jsonb;
  v_already     boolean;
BEGIN
  SELECT a.tenant_id, a.service_id
  INTO v_tenant_id, v_service_id
  FROM appointments a
  WHERE a.id = p_appointment_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Verifica se tenant tem pré-consulta habilitada
  IF NOT (SELECT COALESCE(t.pre_consultation_enabled, false) FROM tenants t WHERE t.id = v_tenant_id) THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Verifica se já respondeu
  SELECT EXISTS(
    SELECT 1 FROM pre_consultation_responses r WHERE r.appointment_id = p_appointment_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('found', false, 'already_submitted', true);
  END IF;

  -- Busca formulário: primeiro específico ao serviço, senão genérico
  SELECT jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'description', f.description,
    'fields', f.fields
  ) INTO v_form
  FROM pre_consultation_forms f
  WHERE f.tenant_id = v_tenant_id
    AND f.is_active = true
    AND (f.service_id = v_service_id OR f.service_id IS NULL)
  ORDER BY
    CASE WHEN f.service_id = v_service_id THEN 0 ELSE 1 END,
    f.created_at DESC
  LIMIT 1;

  IF v_form IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object('found', true, 'form', v_form);
END;
$$;

GRANT EXECUTE ON FUNCTION get_preconsultation_form_for_appointment(uuid) TO authenticated;

-- ─── 6. RPC: Paciente faz check-in online ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.patient_online_checkin(
  p_appointment_id uuid,
  p_form_responses jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_patient_id    uuid;
  v_appt          record;
  v_hours_until   numeric;
  v_form_id       uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  -- Busca patient_id do user
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Perfil de paciente não encontrado');
  END IF;

  -- Busca appointment
  SELECT a.* INTO v_appt
  FROM appointments a
  WHERE a.id = p_appointment_id
    AND (a.client_id = v_patient_id OR a.patient_id = v_patient_id);

  IF v_appt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Consulta não encontrada');
  END IF;

  IF v_appt.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta consulta não pode receber check-in');
  END IF;

  -- Check-in permitido até 24h antes
  v_hours_until := EXTRACT(EPOCH FROM (v_appt.scheduled_at - NOW())) / 3600;
  IF v_hours_until > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Check-in disponível até 24h antes da consulta');
  END IF;

  IF v_hours_until < -2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A consulta já passou');
  END IF;

  -- Salva respostas do questionário se fornecidas
  IF p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb THEN
    -- Busca form_id aplicável
    SELECT f.id INTO v_form_id
    FROM pre_consultation_forms f
    WHERE f.tenant_id = v_appt.tenant_id
      AND f.is_active = true
      AND (f.service_id = v_appt.service_id OR f.service_id IS NULL)
    ORDER BY
      CASE WHEN f.service_id = v_appt.service_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_form_id IS NOT NULL THEN
      INSERT INTO pre_consultation_responses (
        tenant_id, appointment_id, form_id, patient_id, responses
      ) VALUES (
        v_appt.tenant_id, p_appointment_id, v_form_id, v_patient_id, p_form_responses
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Marca check-in + confirma presença
  UPDATE appointments
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    checkin_at = NOW(),
    checkin_method = 'online',
    updated_at = NOW()
  WHERE id = p_appointment_id;

  -- Cria notificação para o profissional
  IF v_appt.professional_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)
    SELECT
      p.user_id,
      v_appt.tenant_id,
      'checkin_online',
      'Check-in Online',
      (SELECT c.name FROM clients c WHERE c.id = v_patient_id) || ' fez check-in online',
      jsonb_build_object(
        'appointment_id', p_appointment_id,
        'patient_id', v_patient_id,
        'checkin_method', 'online',
        'has_preconsultation', (p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb)
      )
    FROM profiles p
    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Check-in realizado com sucesso!');
END;
$$;

GRANT EXECUTE ON FUNCTION patient_online_checkin(uuid, jsonb) TO authenticated;

-- ─── 7. RPC: Confirmação escalonada - auto-libera vaga ─────────────────────

CREATE OR REPLACE FUNCTION public.auto_release_unconfirmed_appointments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_appt  record;
BEGIN
  FOR v_appt IN
    SELECT a.id, a.tenant_id, a.service_id, a.professional_id, a.scheduled_at, a.patient_id
    FROM appointments a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE t.smart_confirmation_enabled = true
      AND a.status IN ('pending')
      AND a.confirmed_at IS NULL
      AND a.confirmation_sent_4h = true
      AND a.confirmation_sent_1h = true
      AND a.scheduled_at <= NOW() + (t.smart_confirmation_autorelease_minutes || ' minutes')::interval
      AND a.scheduled_at > NOW()
      AND a.confirmation_auto_released = false
  LOOP
    -- Cancela o agendamento
    UPDATE appointments
    SET status = 'cancelled',
        confirmation_auto_released = true,
        notes = COALESCE(notes, '') || E'\n[Auto-liberado: paciente não confirmou presença]',
        updated_at = NOW()
    WHERE id = v_appt.id;

    -- Notifica internamente
    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)
    SELECT
      p.user_id,
      v_appt.tenant_id,
      'appointment_auto_released',
      'Vaga auto-liberada',
      'Paciente não confirmou e a vaga foi liberada automaticamente.',
      jsonb_build_object('appointment_id', v_appt.id, 'scheduled_at', v_appt.scheduled_at::text)
    FROM profiles p
    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('released', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION auto_release_unconfirmed_appointments() TO service_role;

-- ─── 8. Grants ─────────────────────────────────────────────────────────────

GRANT SELECT, INSERT ON pre_consultation_forms TO authenticated;
GRANT SELECT, INSERT ON pre_consultation_responses TO authenticated;

SELECT 'Phase 2 migration applied successfully' AS resultado;
