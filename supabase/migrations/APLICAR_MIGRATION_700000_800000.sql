-- ============================================================================
-- CONSOLIDADO: Migrations 700000 + 800000 (PENDENTES)
-- Execute este SQL inteiro no Supabase SQL Editor (uma única vez)
--
-- Inclui:
--   20260703700000 — Rename service_type→procedure_type, fix 4 funções RPC,
--                    ativar patient_bookable para procedimentos/profissionais
--   20260703800000 — Adicionar email_reply_to na tabela tenants
-- ============================================================================

-- ============================================================================
-- PARTE 1: RENAME service_type → procedure_type (20260703700000)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'procedures'
      AND column_name = 'service_type'
  ) THEN
    ALTER TABLE public.procedures RENAME COLUMN service_type TO procedure_type;
  END IF;
END $$;

-- Recriar CHECK constraint com o nome de coluna correto
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.procedures'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%service_type%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.procedures DROP CONSTRAINT %I', v_con);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.procedures
    ADD CONSTRAINT procedures_procedure_type_check
    CHECK (procedure_type IN ('consulta','retorno','procedimento','exame','cirurgia','terapia','outro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PARTE 2: get_patient_bookable_services
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_bookable_services()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id AND t.patient_booking_enabled = true
  ) THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.duration_minutes,
    s.price,
    COALESCE(s.procedure_type, s.name)::text AS category
  FROM public.procedures s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true
  ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_bookable_services() TO authenticated;

-- ============================================================================
-- PARTE 3: get_available_slots_for_patient
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_available_slots_for_patient(
  p_service_id uuid,
  p_professional_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  slot_date date,
  slot_time time,
  slot_datetime timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.procedures%ROWTYPE;
  v_min_hours integer;
  v_max_days integer;
  v_min_datetime timestamptz;
  v_max_datetime timestamptz;
  v_current_date date;
  v_day_of_week integer;
  v_slot_start time;
  v_slot_end time;
  v_slot_datetime timestamptz;
  v_duration interval;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  SELECT t.patient_booking_min_hours_advance, t.patient_booking_max_days_advance
  INTO v_min_hours, v_max_days
  FROM public.tenants t WHERE t.id = v_tenant_id;

  SELECT * INTO v_service
  FROM public.procedures s
  WHERE s.id = p_service_id AND s.tenant_id = v_tenant_id AND s.is_active = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado'; END IF;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_min_datetime := now() + make_interval(hours => v_min_hours);
  v_max_datetime := now() + make_interval(days => v_max_days);

  IF p_date_from < v_min_datetime::date THEN v_current_date := v_min_datetime::date;
  ELSE v_current_date := p_date_from; END IF;

  IF p_date_to > v_max_datetime::date THEN p_date_to := v_max_datetime::date; END IF;

  WHILE v_current_date <= p_date_to LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::integer;

    FOR v_slot_start, v_slot_end IN
      SELECT wh.start_time, wh.end_time
      FROM public.professional_working_hours wh
      WHERE wh.tenant_id = v_tenant_id
        AND wh.professional_id = p_professional_id
        AND wh.day_of_week = v_day_of_week
        AND wh.is_active = true
    LOOP
      WHILE v_slot_start + v_duration <= v_slot_end LOOP
        v_slot_datetime := v_current_date + v_slot_start;

        IF v_slot_datetime >= v_min_datetime THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.tenant_id = v_tenant_id
              AND a.professional_id = p_professional_id
              AND a.status NOT IN ('cancelled')
              AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
                  && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
          ) THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.schedule_blocks sb
              WHERE sb.tenant_id = v_tenant_id
                AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
                AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
            ) THEN
              slot_date := v_current_date;
              slot_time := v_slot_start;
              slot_datetime := v_slot_datetime;
              RETURN NEXT;
            END IF;
          END IF;
        END IF;

        v_slot_start := v_slot_start + interval '30 minutes';
      END LOOP;
    END LOOP;

    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots_for_patient(uuid, uuid, date, date) TO authenticated;

-- ============================================================================
-- PARTE 4: patient_create_appointment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.patient_create_appointment(
  p_procedure_id uuid,
  p_professional_id uuid,
  p_scheduled_at timestamptz,
  p_for_dependent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.procedures%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
  v_pending_count integer;
  v_min_datetime timestamptz;
  v_max_datetime timestamptz;
  v_end_at timestamptz;
  v_has_conflict boolean;
  v_blocked boolean;
  v_within boolean;
  v_appointment_id uuid;
  v_booked_for uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  IF p_for_dependent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.patient_dependents pd
      WHERE pd.id = p_for_dependent_id
        AND pd.parent_patient_id = v_client_id
        AND pd.is_active = true
    ) THEN
      RAISE EXCEPTION 'Dependente não encontrado';
    END IF;
    SELECT pd.dependent_patient_id INTO v_booked_for
    FROM public.patient_dependents pd WHERE pd.id = p_for_dependent_id;
  ELSE
    v_booked_for := v_client_id;
  END IF;

  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;

  IF NOT v_tenant.patient_booking_enabled THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND a.patient_id = v_booked_for
    AND a.status IN ('pending', 'confirmed')
    AND a.scheduled_at > now();

  IF v_pending_count >= v_tenant.patient_booking_max_pending_per_patient THEN
    RAISE EXCEPTION 'Limite de % agendamentos pendentes atingido', v_tenant.patient_booking_max_pending_per_patient;
  END IF;

  SELECT * INTO v_service
  FROM public.procedures s
  WHERE s.id = p_procedure_id AND s.tenant_id = v_tenant_id AND s.is_active = true AND s.patient_bookable = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não disponível para agendamento online'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_tenant_id AND p.patient_bookable = true
  ) THEN
    RAISE EXCEPTION 'Profissional não disponível para agendamento online';
  END IF;

  v_min_datetime := now() + make_interval(hours => v_tenant.patient_booking_min_hours_advance);
  v_max_datetime := now() + make_interval(days => v_tenant.patient_booking_max_days_advance);

  IF p_scheduled_at < v_min_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com pelo menos % horas de antecedência', v_tenant.patient_booking_min_hours_advance;
  END IF;
  IF p_scheduled_at > v_max_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com no máximo % dias de antecedência', v_tenant.patient_booking_max_days_advance;
  END IF;

  v_end_at := p_scheduled_at + make_interval(mins => v_service.duration_minutes);

  BEGIN
    v_within := public.is_slot_within_working_hours_v1(v_tenant_id, p_professional_id, p_scheduled_at, v_end_at);
    IF v_within IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Horário fora do expediente do profissional';
    END IF;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  SELECT EXISTS(
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.tenant_id = v_tenant_id
      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
      AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_blocked;

  IF v_blocked THEN RAISE EXCEPTION 'Horário bloqueado na agenda'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = v_tenant_id
      AND a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled')
      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
          && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_has_conflict;

  IF v_has_conflict THEN RAISE EXCEPTION 'Este horário não está mais disponível'; END IF;

  INSERT INTO public.appointments (
    tenant_id, patient_id, procedure_id, professional_id,
    scheduled_at, duration_minutes, status, price
  ) VALUES (
    v_tenant_id, v_booked_for, v_service.id, p_professional_id,
    p_scheduled_at, v_service.duration_minutes, 'pending', v_service.price
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'message', 'Agendamento realizado com sucesso! Aguarde a confirmação da clínica.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_create_appointment(uuid, uuid, timestamptz, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.patient_create_appointment(uuid, uuid, timestamptz);

-- ============================================================================
-- PARTE 5: submit_appointment_rating
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_appointment_rating(
  p_appointment_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.patient_id = v_client_id
    AND a.tenant_id = v_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Consulta não encontrada'; END IF;

  IF v_appointment.status != 'completed' THEN
    RAISE EXCEPTION 'Apenas consultas concluídas podem ser avaliadas';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointment_ratings WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'Esta consulta já foi avaliada';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Avaliação deve ser entre 1 e 5';
  END IF;

  INSERT INTO public.appointment_ratings (
    tenant_id, appointment_id, patient_user_id, rating, comment
  ) VALUES (
    v_tenant_id, p_appointment_id, v_user_id, p_rating, NULLIF(BTRIM(p_comment), '')
  );

  RETURN jsonb_build_object('success', true, 'message', 'Obrigado pela sua avaliação!');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_appointment_rating(uuid, integer, text) TO authenticated;

-- ============================================================================
-- PARTE 6: ATIVAR patient_bookable
-- ============================================================================

UPDATE public.procedures
SET patient_bookable = true
WHERE is_active = true AND patient_bookable = false;

UPDATE public.profiles
SET patient_bookable = true
WHERE patient_bookable = false;

ALTER TABLE public.procedures ALTER COLUMN patient_bookable SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN patient_bookable SET DEFAULT true;

-- ============================================================================
-- PARTE 7: email_reply_to (20260703800000)
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_reply_to TEXT;

COMMENT ON COLUMN public.tenants.email_reply_to IS
  'Email de contato da clínica usado como Reply-To nos emails enviados em nome dela';

-- ============================================================================
-- FIM — Migrations 700000 + 800000 aplicadas!
-- ============================================================================
