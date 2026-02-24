-- ============================================================================
-- FIX: Corrigir funções da Fase 29 para usar patient_profiles em vez de clients.patient_user_id
-- A tabela clients NÃO tem coluna patient_user_id. O vínculo é feito via patient_profiles.
-- ============================================================================

-- Helper function para obter client_id e tenant_id do paciente autenticado
CREATE OR REPLACE FUNCTION public.get_patient_link()
RETURNS TABLE (client_id uuid, tenant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pp.client_id, pp.tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid()
    AND pp.is_active = true
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_link() TO authenticated;

-- ============================================================================
-- FASE 29A: Corrigir funções de agendamento
-- ============================================================================

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
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

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
    s.service_type as category
  FROM public.services s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true
  ORDER BY s.name;
END;
$$;

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
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
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
  ORDER BY p.full_name;
END;
$$;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  SELECT t.patient_booking_min_hours_advance, t.patient_booking_max_days_advance
  INTO v_min_hours, v_max_days
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id AND s.tenant_id = v_tenant_id AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_min_datetime := now() + make_interval(hours => v_min_hours);
  v_max_datetime := now() + make_interval(days => v_max_days);

  IF p_date_from < v_min_datetime::date THEN
    v_current_date := v_min_datetime::date;
  ELSE
    v_current_date := p_date_from;
  END IF;

  IF p_date_to > v_max_datetime::date THEN
    p_date_to := v_max_datetime::date;
  END IF;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;

  IF NOT v_tenant.patient_booking_enabled THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND a.client_id = v_client_id
    AND a.status IN ('pending', 'confirmed')
    AND a.scheduled_at > now();

  IF v_pending_count >= v_tenant.patient_booking_max_pending_per_patient THEN
    RAISE EXCEPTION 'Você atingiu o limite de % agendamentos pendentes', v_tenant.patient_booking_max_pending_per_patient;
  END IF;

  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não disponível para agendamento online';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id
      AND p.tenant_id = v_tenant_id
      AND p.patient_bookable = true
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

  v_within := public.is_slot_within_working_hours_v1(v_tenant_id, p_professional_id, p_scheduled_at, v_end_at);
  IF v_within IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Horário fora do expediente do profissional';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.tenant_id = v_tenant_id
      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
      AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'Horário bloqueado na agenda';
  END IF;

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

  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, professional_id,
    scheduled_at, duration_minutes, status, price
  ) VALUES (
    v_tenant_id, v_client_id, v_service.id, p_professional_id,
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
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

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

-- 10) RPC: Obter configurações de agendamento do tenant
CREATE OR REPLACE FUNCTION public.get_patient_booking_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'not_linked');
  END IF;

  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;

  RETURN jsonb_build_object(
    'enabled', v_tenant.patient_booking_enabled,
    'min_hours_advance', v_tenant.patient_booking_min_hours_advance,
    'max_days_advance', v_tenant.patient_booking_max_days_advance,
    'max_pending', v_tenant.patient_booking_max_pending_per_patient,
    'clinic_name', v_tenant.name
  );
END;
$$;

-- ============================================================================
-- FASE 29B: Corrigir funções financeiras
-- ============================================================================

-- Corrigir RLS policies das tabelas financeiras
DROP POLICY IF EXISTS "patient_invoices_patient_select" ON public.patient_invoices;
CREATE POLICY "patient_invoices_patient_select" ON public.patient_invoices
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_payments_patient_select" ON public.patient_payments;
CREATE POLICY "patient_payments_patient_select" ON public.patient_payments
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT pi.id FROM public.patient_invoices pi
      WHERE pi.client_id IN (
        SELECT pp.client_id FROM public.patient_profiles pp 
        WHERE pp.user_id = auth.uid() AND pp.is_active = true
      )
    )
  );

-- RPC: Obter resumo financeiro do paciente
CREATE OR REPLACE FUNCTION public.get_patient_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_total_pending numeric;
  v_total_overdue numeric;
  v_next_due_date date;
  v_next_due_amount numeric;
  v_last_payment_date timestamptz;
  v_last_payment_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_linked');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pending
  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_overdue
  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'overdue';

  SELECT due_date, amount INTO v_next_due_date, v_next_due_amount
  FROM public.patient_invoices
  WHERE client_id = v_client_id AND status IN ('pending', 'overdue')
  ORDER BY due_date ASC LIMIT 1;

  SELECT pp.paid_at, pp.amount INTO v_last_payment_date, v_last_payment_amount
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id AND pp.status = 'completed'
  ORDER BY pp.paid_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'total_pending', v_total_pending,
    'total_overdue', v_total_overdue,
    'total_due', v_total_pending + v_total_overdue,
    'next_due_date', v_next_due_date,
    'next_due_amount', v_next_due_amount,
    'last_payment_date', v_last_payment_date,
    'last_payment_amount', v_last_payment_amount
  );
END;
$$;

-- RPC: Listar faturas do paciente
CREATE OR REPLACE FUNCTION public.get_patient_invoices(
  p_status text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, description text, amount numeric, due_date date, status text,
  paid_at timestamptz, paid_amount numeric, payment_method text,
  payment_url text, appointment_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pi.id, pi.description, pi.amount, pi.due_date, pi.status,
    pi.paid_at, pi.paid_amount, pi.payment_method, pi.payment_url,
    pi.appointment_id, pi.created_at
  FROM public.patient_invoices pi
  WHERE pi.client_id = v_client_id
    AND (p_status IS NULL OR pi.status = p_status)
    AND (p_from IS NULL OR pi.due_date >= p_from)
    AND (p_to IS NULL OR pi.due_date <= p_to)
  ORDER BY CASE WHEN pi.status IN ('pending', 'overdue') THEN 0 ELSE 1 END, pi.due_date DESC;
END;
$$;

-- RPC: Obter histórico de pagamentos
CREATE OR REPLACE FUNCTION public.get_patient_payment_history(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, invoice_id uuid, invoice_description text, amount numeric,
  payment_method text, status text, paid_at timestamptz, receipt_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pp.id, pp.invoice_id, pi.description, pp.amount,
    pp.payment_method, pp.status, pp.paid_at, pp.receipt_url
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id
  ORDER BY pp.paid_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;
