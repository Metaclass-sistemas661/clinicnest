-- ============================================================================
-- FIX: Corrigir funções do portal do paciente após rename
--      services → procedures / service_id → procedure_id  (migração 20260330400000)
--      clients  → patients  / client_id  → patient_id     (migração 20260330300000)
--
-- Funções corrigidas:
--   1. get_patient_dashboard_summary  — a.service_id → a.procedure_id
--   2. get_patient_health_timeline    — a.service_id → a.procedure_id
--   3. get_patient_pending_ratings    — a.service_id, a.client_id
--   4. get_patient_telemedicine_appointments — a.service_id, a.client_id
--   5. check_patient_achievements     — a.client_id → a.patient_id
--   6. get_patient_dependents         — client_id refs → patient_id refs
--   7. RLS policy pacientes em tenants
-- ============================================================================

-- ============================================================================
-- 1. get_patient_dashboard_summary — service_id → procedure_id, services → procedures
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_tenant_id uuid;
  v_clinic_name text;
  v_upcoming_appointments jsonb;
  v_upcoming_teleconsultas jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_linked', false,
      'clinic_name', null,
      'upcoming_appointments', '[]'::jsonb,
      'upcoming_teleconsultas', '[]'::jsonb
    );
  END IF;

  SELECT pp.client_id, pp.tenant_id, t.name
  INTO v_client_id, v_tenant_id, v_clinic_name
  FROM public.patient_profiles pp
  JOIN public.tenants t ON t.id = pp.tenant_id
  WHERE pp.user_id = v_user_id
    AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_linked', false,
      'clinic_name', null,
      'upcoming_appointments', '[]'::jsonb,
      'upcoming_teleconsultas', '[]'::jsonb
    );
  END IF;

  -- Upcoming appointments (non-telemedicine)
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb)
  INTO v_upcoming_appointments
  FROM (
    SELECT
      a.id,
      a.scheduled_at,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name,
      a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id
      AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at > now()
      AND (a.telemedicine IS NULL OR a.telemedicine = false)
    ORDER BY a.scheduled_at
    LIMIT 5
  ) r;

  -- Upcoming teleconsultas
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb)
  INTO v_upcoming_teleconsultas
  FROM (
    SELECT
      a.id,
      a.scheduled_at,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name,
      a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id
      AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at > now()
      AND a.telemedicine = true
    ORDER BY a.scheduled_at
    LIMIT 3
  ) r;

  RETURN jsonb_build_object(
    'is_linked', true,
    'clinic_name', v_clinic_name,
    'upcoming_appointments', v_upcoming_appointments,
    'upcoming_teleconsultas', v_upcoming_teleconsultas
  );
END;
$$;

-- ============================================================================
-- 2. get_patient_health_timeline — service_id → procedure_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, event_type text, event_date timestamptz, title text,
  description text, professional_name text, metadata jsonb
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

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  -- Consultas completadas
  SELECT a.id, 'appointment'::text, a.scheduled_at,
    COALESCE(s.name, 'Consulta')::text,
    COALESCE(a.notes, '')::text,
    COALESCE(p.full_name, '')::text,
    jsonb_build_object('status', a.status, 'procedure_id', a.procedure_id)
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id = a.procedure_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id AND a.status = 'completed'

  UNION ALL

  -- Receitas
  SELECT pr.id, 'prescription'::text, pr.created_at,
    ('Receita ' || COALESCE(pr.prescription_type, 'simples'))::text,
    LEFT(COALESCE(pr.medications, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('type', pr.prescription_type, 'status', pr.status)
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.patient_id = v_client_id AND pr.tenant_id = v_tenant_id

  UNION ALL

  -- Exames
  SELECT er.id, 'exam'::text, er.created_at,
    COALESCE(er.exam_name, 'Exame')::text,
    COALESCE(er.result_text, '')::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('status', er.status, 'priority', er.priority)
  FROM public.exam_results er
  LEFT JOIN public.profiles prof ON prof.id = er.requested_by
  WHERE er.patient_id = v_client_id AND er.tenant_id = v_tenant_id

  UNION ALL

  -- Atestados
  SELECT mc.id, 'certificate'::text, mc.issued_at,
    CASE mc.certificate_type
      WHEN 'atestado' THEN 'Atestado Médico'
      WHEN 'declaracao_comparecimento' THEN 'Declaração de Comparecimento'
      WHEN 'laudo' THEN 'Laudo'
      WHEN 'relatorio' THEN 'Relatório'
      ELSE 'Atestado'
    END::text,
    LEFT(COALESCE(mc.content, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('type', mc.certificate_type, 'days_off', mc.days_off, 'cid_code', mc.cid_code)
  FROM public.medical_certificates mc
  LEFT JOIN public.profiles prof ON prof.id = mc.professional_id
  WHERE mc.patient_id = v_client_id AND mc.tenant_id = v_tenant_id

  UNION ALL

  -- Laudos médicos
  SELECT mr.id, 'medical_report'::text, mr.created_at,
    CASE mr.tipo
      WHEN 'medico' THEN 'Laudo Médico'
      WHEN 'pericial' THEN 'Laudo Pericial'
      WHEN 'aptidao' THEN 'Atestado de Aptidão'
      WHEN 'capacidade' THEN 'Laudo de Capacidade'
      WHEN 'complementar' THEN 'Laudo Complementar'
      WHEN 'psicologico' THEN 'Laudo Psicológico'
      WHEN 'neuropsicologico' THEN 'Avaliação Neuropsicológica'
      WHEN 'ocupacional' THEN 'Laudo Ocupacional'
      ELSE 'Laudo'
    END::text,
    LEFT(COALESCE(mr.conclusao, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('tipo', mr.tipo, 'status', mr.status, 'cid10', mr.cid10)
  FROM public.medical_reports mr
  LEFT JOIN public.profiles prof ON prof.id = mr.professional_id
  WHERE mr.patient_id = v_client_id AND mr.tenant_id = v_tenant_id
    AND mr.status IN ('finalizado', 'assinado')

  UNION ALL

  -- Encaminhamentos
  SELECT rf.id, 'referral'::text, rf.created_at,
    ('Encaminhamento — ' || COALESCE(sp.name, 'Especialista'))::text,
    LEFT(COALESCE(rf.reason, ''), 200)::text,
    COALESCE(from_prof.full_name, '')::text,
    jsonb_build_object('status', rf.status, 'priority', rf.priority)
  FROM public.referrals rf
  LEFT JOIN public.profiles from_prof ON from_prof.id = rf.from_professional
  LEFT JOIN public.specialties sp ON sp.id = rf.to_specialty_id
  WHERE rf.patient_id = v_client_id AND rf.tenant_id = v_tenant_id

  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 3. get_patient_pending_ratings — service_id → procedure_id, client_id → patient_id
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_pending_ratings();
CREATE OR REPLACE FUNCTION public.get_patient_pending_ratings()
RETURNS TABLE (
  appointment_id uuid, scheduled_at timestamptz, service_name text, professional_name text
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
  SELECT a.id, a.scheduled_at, COALESCE(s.name, 'Consulta')::text, COALESCE(p.full_name, '')::text
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id = a.procedure_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.patient_id = v_client_id
    AND a.status = 'completed'
    AND a.scheduled_at > now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_ratings ar WHERE ar.appointment_id = a.id
    )
  ORDER BY a.scheduled_at DESC
  LIMIT 5;
END;
$$;

-- ============================================================================
-- 4. get_patient_telemedicine_appointments — service_id → procedure_id, client_id → patient_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_telemedicine_appointments(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.id,
      a.tenant_id,
      a.scheduled_at,
      a.duration_minutes,
      a.status,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp ON pp.tenant_id = a.tenant_id AND pp.client_id = a.patient_id
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE pp.user_id = v_user_id
      AND pp.is_active = true
      AND a.telemedicine = true
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at >= (p_date::timestamptz)
      AND a.scheduled_at < (p_date + interval '1 day')::timestamptz
    ORDER BY a.scheduled_at
  ) r;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. check_patient_achievements — client_id → patient_id na tabela appointments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_patient_achievements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_new_achievements text[] := '{}';
  v_appointment_count integer;
  v_rating_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('new_achievements', v_new_achievements);
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('new_achievements', v_new_achievements);
  END IF;

  -- Contar consultas concluídas
  SELECT COUNT(*) INTO v_appointment_count
  FROM public.appointments
  WHERE patient_id = v_client_id AND status = 'completed';

  -- Primeira consulta
  IF v_appointment_count >= 1 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_user_id, 'first_appointment', 'Primeira Consulta')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Primeira Consulta'); END IF;
  END IF;

  -- 5 consultas
  IF v_appointment_count >= 5 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_user_id, 'five_appointments', 'Paciente Frequente')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Paciente Frequente'); END IF;
  END IF;

  -- 10 consultas
  IF v_appointment_count >= 10 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_user_id, 'ten_appointments', 'Paciente Fiel')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Paciente Fiel'); END IF;
  END IF;

  -- Avaliou atendimento
  SELECT COUNT(*) INTO v_rating_count
  FROM public.appointment_ratings
  WHERE patient_user_id = v_user_id;

  IF v_rating_count >= 1 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_user_id, 'first_rating', 'Avaliador')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Avaliador'); END IF;
  END IF;

  RETURN jsonb_build_object('new_achievements', v_new_achievements);
END;
$$;

-- ============================================================================
-- 6. get_patient_dependents — client_id refs → patient_id, clients → patients
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_dependents();
CREATE OR REPLACE FUNCTION public.get_patient_dependents()
RETURNS TABLE (
  id uuid, name text, relationship text, birth_date date, cpf text, created_at timestamptz
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
  SELECT pd.id, c.name, pd.relationship, c.date_of_birth, c.cpf, pd.created_at
  FROM public.patient_dependents pd
  JOIN public.patients c ON c.id = pd.dependent_patient_id
  WHERE pd.parent_patient_id = v_client_id AND pd.is_active = true
  ORDER BY c.name;
END;
$$;

-- Fix RLS policy for patient_dependents too
DROP POLICY IF EXISTS "patient_dependents_patient_select" ON public.patient_dependents;
CREATE POLICY "patient_dependents_patient_select" ON public.patient_dependents
  FOR SELECT TO authenticated
  USING (
    parent_patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- ============================================================================
-- 7. RLS: Permitir pacientes lerem seu tenant (via patient_profiles)
--    Sem isso, o hook useClinicSubscriptionStatus recebe 406 ao buscar tenants.
-- ============================================================================
DROP POLICY IF EXISTS "Patients can view their linked tenant" ON public.tenants;
CREATE POLICY "Patients can view their linked tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT pp.tenant_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_patient_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_pending_ratings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_telemedicine_appointments(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_patient_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_dependents() TO authenticated;
