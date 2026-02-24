-- ============================================================================
-- FASE 29A: Agendamento Online Self-Service (Portal do Paciente)
-- ============================================================================

-- 1) Configurações de agendamento no tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS patient_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS patient_booking_min_hours_advance integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS patient_booking_max_days_advance integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS patient_booking_max_pending_per_patient integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.tenants.patient_booking_enabled IS 'Habilita agendamento self-service no portal do paciente';
COMMENT ON COLUMN public.tenants.patient_booking_min_hours_advance IS 'Antecedência mínima em horas para agendamento';
COMMENT ON COLUMN public.tenants.patient_booking_max_days_advance IS 'Antecedência máxima em dias para agendamento';
COMMENT ON COLUMN public.tenants.patient_booking_max_pending_per_patient IS 'Máximo de agendamentos pendentes por paciente';

-- 2) Serviços disponíveis para agendamento online pelo paciente
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS patient_bookable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.services.patient_bookable IS 'Serviço disponível para agendamento pelo paciente no portal';

-- 3) Profissionais disponíveis para agendamento online
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS patient_bookable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.patient_bookable IS 'Profissional disponível para agendamento pelo paciente no portal';

-- 4) Tabela de avaliações de consultas
CREATE TABLE IF NOT EXISTS public.appointment_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_ratings_tenant ON public.appointment_ratings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_ratings_patient ON public.appointment_ratings(patient_user_id);

ALTER TABLE public.appointment_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_ratings_patient_insert" ON public.appointment_ratings;
CREATE POLICY "appointment_ratings_patient_insert" ON public.appointment_ratings
  FOR INSERT TO authenticated
  WITH CHECK (patient_user_id = auth.uid());

DROP POLICY IF EXISTS "appointment_ratings_patient_select" ON public.appointment_ratings;
CREATE POLICY "appointment_ratings_patient_select" ON public.appointment_ratings
  FOR SELECT TO authenticated
  USING (patient_user_id = auth.uid());

DROP POLICY IF EXISTS "appointment_ratings_tenant_select" ON public.appointment_ratings;
CREATE POLICY "appointment_ratings_tenant_select" ON public.appointment_ratings
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 5) RPC: Obter serviços disponíveis para agendamento pelo paciente
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
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  -- Verificar se tenant permite agendamento
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = v_tenant_id AND t.patient_booking_enabled = true
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
    s.category
  FROM public.services s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true
  ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_bookable_services() TO authenticated;

-- 6) RPC: Obter profissionais disponíveis para um serviço
CREATE OR REPLACE FUNCTION public.get_patient_bookable_professionals(p_service_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  professional_type text,
  council_type text,
  council_number text,
  council_state text,
  avg_rating numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT c.id, c.tenant_id INTO v_client_id, v_tenant_id
  FROM public.clients c
  WHERE c.patient_user_id = v_patient_user_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.professional_type::text,
    p.council_type,
    p.council_number,
    p.council_state,
    COALESCE(
      (SELECT AVG(ar.rating)::numeric(3,2)
       FROM public.appointment_ratings ar
       JOIN public.appointments a ON a.id = ar.appointment_id
       WHERE a.professional_id = p.id),
      0
    ) as avg_rating
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant_id
    AND p.patient_bookable = true
    AND EXISTS (
      SELECT 1 FROM public.professional_services ps
      WHERE ps.professional_id = p.id AND ps.service_id = p_service_id
    )
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_bookable_professionals(uuid) TO authenticated;

-- 7) RPC: Obter slots disponíveis para agendamento
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
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.services%ROWTYPE;
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
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT c.id, c.tenant_id INTO v_client_id, v_tenant_id
  FROM public.clients c
  WHERE c.patient_user_id = v_patient_user_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  -- Obter configurações do tenant
  SELECT t.patient_booking_min_hours_advance, t.patient_booking_max_days_advance
  INTO v_min_hours, v_max_days
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  -- Obter serviço
  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id AND s.tenant_id = v_tenant_id AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_min_datetime := now() + make_interval(hours => v_min_hours);
  v_max_datetime := now() + make_interval(days => v_max_days);

  -- Ajustar datas
  IF p_date_from < v_min_datetime::date THEN
    v_current_date := v_min_datetime::date;
  ELSE
    v_current_date := p_date_from;
  END IF;

  IF p_date_to > v_max_datetime::date THEN
    p_date_to := v_max_datetime::date;
  END IF;

  -- Iterar por cada dia
  WHILE v_current_date <= p_date_to LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::integer;

    -- Obter horários de trabalho do profissional para este dia
    FOR v_slot_start, v_slot_end IN
      SELECT wh.start_time, wh.end_time
      FROM public.working_hours wh
      WHERE wh.tenant_id = v_tenant_id
        AND wh.professional_id = p_professional_id
        AND wh.day_of_week = v_day_of_week
        AND wh.is_active = true
    LOOP
      -- Gerar slots de 30 em 30 minutos
      WHILE v_slot_start + v_duration <= v_slot_end LOOP
        v_slot_datetime := v_current_date + v_slot_start;

        -- Verificar se está no futuro mínimo
        IF v_slot_datetime >= v_min_datetime THEN
          -- Verificar se não há conflito
          IF NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.tenant_id = v_tenant_id
              AND a.professional_id = p_professional_id
              AND a.status NOT IN ('cancelled')
              AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
                  && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
          ) THEN
            -- Verificar se não está bloqueado
            IF NOT EXISTS (
              SELECT 1 FROM public.schedule_blocks sb
              WHERE sb.tenant_id = v_tenant_id
                AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
                AND tstzrange(sb.start_at, sb.end_at, '[)')
                    && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
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

-- 8) RPC: Criar agendamento pelo paciente
CREATE OR REPLACE FUNCTION public.patient_create_appointment(
  p_service_id uuid,
  p_professional_id uuid,
  p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.services%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
  v_pending_count integer;
  v_min_datetime timestamptz;
  v_max_datetime timestamptz;
  v_end_at timestamptz;
  v_has_conflict boolean;
  v_blocked boolean;
  v_within boolean;
  v_appointment_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Obter client_id e tenant_id
  SELECT c.id, c.tenant_id INTO v_client_id, v_tenant_id
  FROM public.clients c
  WHERE c.patient_user_id = v_patient_user_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  -- Obter tenant
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF NOT v_tenant.patient_booking_enabled THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  -- Verificar limite de agendamentos pendentes
  SELECT COUNT(*) INTO v_pending_count
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND a.client_id = v_client_id
    AND a.status IN ('pending', 'confirmed')
    AND a.scheduled_at > now();

  IF v_pending_count >= v_tenant.patient_booking_max_pending_per_patient THEN
    RAISE EXCEPTION 'Você atingiu o limite de % agendamentos pendentes', v_tenant.patient_booking_max_pending_per_patient;
  END IF;

  -- Obter serviço
  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não disponível para agendamento online';
  END IF;

  -- Verificar profissional
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id
      AND p.tenant_id = v_tenant_id
      AND p.patient_bookable = true
  ) THEN
    RAISE EXCEPTION 'Profissional não disponível para agendamento online';
  END IF;

  -- Verificar antecedência
  v_min_datetime := now() + make_interval(hours => v_tenant.patient_booking_min_hours_advance);
  v_max_datetime := now() + make_interval(days => v_tenant.patient_booking_max_days_advance);

  IF p_scheduled_at < v_min_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com pelo menos % horas de antecedência', v_tenant.patient_booking_min_hours_advance;
  END IF;

  IF p_scheduled_at > v_max_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com no máximo % dias de antecedência', v_tenant.patient_booking_max_days_advance;
  END IF;

  v_end_at := p_scheduled_at + make_interval(mins => v_service.duration_minutes);

  -- Verificar horário de trabalho
  v_within := public.is_slot_within_working_hours_v1(v_tenant_id, p_professional_id, p_scheduled_at, v_end_at);
  IF v_within IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Horário fora do expediente do profissional';
  END IF;

  -- Verificar bloqueios
  SELECT EXISTS(
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.tenant_id = v_tenant_id
      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
      AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'Horário bloqueado na agenda';
  END IF;

  -- Verificar conflitos (lock otimista)
  SELECT EXISTS(
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = v_tenant_id
      AND a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled')
      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
          && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RAISE EXCEPTION 'Este horário não está mais disponível';
  END IF;

  -- Criar agendamento
  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    created_via
  ) VALUES (
    v_tenant_id,
    v_client_id,
    v_service.id,
    p_professional_id,
    p_scheduled_at,
    v_service.duration_minutes,
    'pending',
    v_service.price,
    'patient_portal'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'message', 'Agendamento realizado com sucesso! Aguarde a confirmação da clínica.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_create_appointment(uuid, uuid, timestamptz) TO authenticated;

-- 9) RPC: Submeter avaliação de consulta
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
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Obter client_id
  SELECT c.id, c.tenant_id INTO v_client_id, v_tenant_id
  FROM public.clients c
  WHERE c.patient_user_id = v_patient_user_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  -- Verificar agendamento
  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.client_id = v_client_id
    AND a.tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;

  IF v_appointment.status != 'completed' THEN
    RAISE EXCEPTION 'Apenas consultas concluídas podem ser avaliadas';
  END IF;

  -- Verificar se já foi avaliada
  IF EXISTS (SELECT 1 FROM public.appointment_ratings WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'Esta consulta já foi avaliada';
  END IF;

  -- Validar rating
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Avaliação deve ser entre 1 e 5';
  END IF;

  -- Inserir avaliação
  INSERT INTO public.appointment_ratings (
    tenant_id,
    appointment_id,
    patient_user_id,
    rating,
    comment
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    v_patient_user_id,
    p_rating,
    NULLIF(BTRIM(p_comment), '')
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Obrigado pela sua avaliação!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_appointment_rating(uuid, integer, text) TO authenticated;

-- 10) RPC: Obter configurações de agendamento do tenant (para o paciente)
CREATE OR REPLACE FUNCTION public.get_patient_booking_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT c.id, c.tenant_id INTO v_client_id, v_tenant_id
  FROM public.clients c
  WHERE c.patient_user_id = v_patient_user_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'enabled', false,
      'reason', 'not_linked'
    );
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  RETURN jsonb_build_object(
    'enabled', v_tenant.patient_booking_enabled,
    'min_hours_advance', v_tenant.patient_booking_min_hours_advance,
    'max_days_advance', v_tenant.patient_booking_max_days_advance,
    'max_pending', v_tenant.patient_booking_max_pending_per_patient,
    'clinic_name', v_tenant.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_booking_settings() TO authenticated;
