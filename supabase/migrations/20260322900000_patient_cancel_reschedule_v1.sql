-- Fase 4: RPCs para paciente cancelar e reagendar consultas (self-service)

-- ─── patient_cancel_appointment ─────────────────────────────────────────────
-- Permite o paciente cancelar sua própria consulta, desde que:
--   1. A consulta esteja pendente ou confirmada (não concluída/cancelada)
--   2. Faltem pelo menos 24h para o horário agendado
CREATE OR REPLACE FUNCTION public.patient_cancel_appointment(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_apt    public.appointments%ROWTYPE;
  v_linked boolean;
  v_hours  numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT a.* INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_profiles pp
    WHERE pp.user_id = v_user_id
      AND pp.tenant_id = v_apt.tenant_id
      AND pp.client_id = v_apt.client_id
      AND pp.is_active = true
  ) INTO v_linked;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta consulta';
  END IF;

  IF v_apt.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Só é possível cancelar consultas pendentes ou confirmadas. Status atual: %', v_apt.status;
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_apt.scheduled_at - now())) / 3600.0;
  IF v_hours < 24 THEN
    RAISE EXCEPTION 'Cancelamento deve ser feito com pelo menos 24 horas de antecedência (faltam %.0f horas)', v_hours;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('patient_cancel'));

  UPDATE public.appointments
    SET status = 'cancelled',
        updated_at = now(),
        notes = CASE
          WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN COALESCE(notes, '') || E'\n[Cancelado pelo paciente via portal]'
          ELSE COALESCE(notes, '') || E'\n[Cancelado pelo paciente]: ' || p_reason
        END
  WHERE id = v_apt.id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id,
    'message', 'Consulta cancelada com sucesso'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.patient_cancel_appointment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.patient_cancel_appointment(uuid, text) TO authenticated;

-- ─── patient_reschedule_appointment ─────────────────────────────────────────
-- Permite o paciente solicitar reagendamento para nova data/hora.
-- Regras:
--   1. Consulta pendente ou confirmada
--   2. Pelo menos 24h de antecedência do horário original
--   3. Nova data deve ser no futuro (mínimo 1h a partir de agora)
--   4. Verifica conflito de horário com outros agendamentos do profissional
CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(
  p_appointment_id uuid,
  p_new_scheduled_at timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_apt        public.appointments%ROWTYPE;
  v_linked     boolean;
  v_hours      numeric;
  v_conflict   boolean;
  v_end_time   timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT a.* INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_profiles pp
    WHERE pp.user_id = v_user_id
      AND pp.tenant_id = v_apt.tenant_id
      AND pp.client_id = v_apt.client_id
      AND pp.is_active = true
  ) INTO v_linked;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'Sem permissão para reagendar esta consulta';
  END IF;

  IF v_apt.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Só é possível reagendar consultas pendentes ou confirmadas. Status atual: %', v_apt.status;
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_apt.scheduled_at - now())) / 3600.0;
  IF v_hours < 24 THEN
    RAISE EXCEPTION 'Reagendamento deve ser feito com pelo menos 24 horas de antecedência (faltam %.0f horas)', v_hours;
  END IF;

  IF p_new_scheduled_at <= now() + interval '1 hour' THEN
    RAISE EXCEPTION 'A nova data deve ser pelo menos 1 hora no futuro';
  END IF;

  v_end_time := p_new_scheduled_at + (v_apt.duration_minutes || ' minutes')::interval;

  SELECT EXISTS(
    SELECT 1 FROM public.appointments a2
    WHERE a2.tenant_id = v_apt.tenant_id
      AND a2.professional_id = v_apt.professional_id
      AND a2.id <> v_apt.id
      AND a2.status IN ('pending', 'confirmed')
      AND a2.scheduled_at < v_end_time
      AND (a2.scheduled_at + (a2.duration_minutes || ' minutes')::interval) > p_new_scheduled_at
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'O profissional já possui outro agendamento neste horário. Escolha outro horário.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('patient_reschedule'));

  UPDATE public.appointments
    SET scheduled_at = p_new_scheduled_at,
        status = 'pending',
        updated_at = now(),
        notes = CASE
          WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN COALESCE(notes, '') || E'\n[Reagendado pelo paciente via portal]'
          ELSE COALESCE(notes, '') || E'\n[Reagendado pelo paciente]: ' || p_reason
        END
  WHERE id = v_apt.id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id,
    'new_scheduled_at', p_new_scheduled_at,
    'message', 'Consulta reagendada com sucesso'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.patient_reschedule_appointment(uuid, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.patient_reschedule_appointment(uuid, timestamptz, text) TO authenticated;
