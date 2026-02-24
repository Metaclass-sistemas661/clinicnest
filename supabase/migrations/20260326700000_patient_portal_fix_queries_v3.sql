-- ============================================================================
-- FIX PARTE 3: Corrigir funções de Engagement (Dependentes, Onboarding, Achievements)
-- ============================================================================

-- ============================================================================
-- FASE 29E: Corrigir funções de engajamento
-- ============================================================================

-- Corrigir RLS de dependentes
DROP POLICY IF EXISTS "patient_dependents_patient_select" ON public.patient_dependents;
CREATE POLICY "patient_dependents_patient_select" ON public.patient_dependents
  FOR SELECT TO authenticated
  USING (
    parent_client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RPC: Obter dependentes do paciente
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
  SELECT pd.id, c.name, pd.relationship, c.birth_date, c.cpf, pd.created_at
  FROM public.patient_dependents pd
  JOIN public.clients c ON c.id = pd.dependent_client_id
  WHERE pd.parent_client_id = v_client_id AND pd.is_active = true
  ORDER BY c.name;
END;
$$;

-- RPC: Verificar conquistas do paciente
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
  WHERE client_id = v_client_id AND status = 'completed';

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

-- RPC: Obter avaliações pendentes
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
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.client_id = v_client_id
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
-- Verificar e corrigir tabela working_hours vs professional_working_hours
-- ============================================================================

-- A tabela correta é professional_working_hours (conforme types.ts)
-- Garantir que a função get_available_slots_for_patient use o nome correto
-- (já corrigido na migration anterior)
