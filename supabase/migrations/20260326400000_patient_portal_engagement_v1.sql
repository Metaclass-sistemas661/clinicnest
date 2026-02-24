-- ============================================================================
-- FASE 29E: Engajamento & Experiência (Portal do Paciente)
-- ============================================================================

-- 1) Tabela de dependentes do paciente
CREATE TABLE IF NOT EXISTS public.patient_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dependent_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  relationship text NOT NULL CHECK (relationship IN ('filho', 'filha', 'pai', 'mae', 'conjuge', 'outro')),
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(parent_client_id, dependent_client_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_dependents_parent ON public.patient_dependents(parent_client_id);
CREATE INDEX IF NOT EXISTS idx_patient_dependents_tenant ON public.patient_dependents(tenant_id);

ALTER TABLE public.patient_dependents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_dependents_patient_select" ON public.patient_dependents;
CREATE POLICY "patient_dependents_patient_select" ON public.patient_dependents
  FOR SELECT TO authenticated
  USING (
    parent_client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_dependents_tenant_all" ON public.patient_dependents;
CREATE POLICY "patient_dependents_tenant_all" ON public.patient_dependents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2) Tabela de onboarding do paciente
CREATE TABLE IF NOT EXISTS public.patient_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id uuid NOT NULL UNIQUE,
  
  tour_completed boolean NOT NULL DEFAULT false,
  tour_completed_at timestamptz,
  tour_skipped boolean NOT NULL DEFAULT false,
  
  first_login_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  login_count integer NOT NULL DEFAULT 1,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_onboarding_user ON public.patient_onboarding(patient_user_id);

ALTER TABLE public.patient_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_onboarding_own" ON public.patient_onboarding;
CREATE POLICY "patient_onboarding_own" ON public.patient_onboarding
  FOR ALL TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

-- 3) Tabela de conquistas/badges do paciente
CREATE TABLE IF NOT EXISTS public.patient_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id uuid NOT NULL,
  
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(patient_user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_patient_achievements_user ON public.patient_achievements(patient_user_id);

ALTER TABLE public.patient_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_achievements_own" ON public.patient_achievements;
CREATE POLICY "patient_achievements_own" ON public.patient_achievements
  FOR SELECT TO authenticated
  USING (patient_user_id = auth.uid());

-- 4) RPC: Registrar/atualizar onboarding
CREATE OR REPLACE FUNCTION public.update_patient_onboarding(
  p_tour_completed boolean DEFAULT NULL,
  p_tour_skipped boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_onboarding public.patient_onboarding%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Upsert onboarding record
  INSERT INTO public.patient_onboarding (patient_user_id, last_login_at, login_count)
  VALUES (v_patient_user_id, now(), 1)
  ON CONFLICT (patient_user_id) DO UPDATE SET
    last_login_at = now(),
    login_count = patient_onboarding.login_count + 1,
    tour_completed = COALESCE(p_tour_completed, patient_onboarding.tour_completed),
    tour_completed_at = CASE WHEN p_tour_completed = true THEN now() ELSE patient_onboarding.tour_completed_at END,
    tour_skipped = COALESCE(p_tour_skipped, patient_onboarding.tour_skipped)
  RETURNING * INTO v_onboarding;

  RETURN jsonb_build_object(
    'tour_completed', v_onboarding.tour_completed,
    'tour_skipped', v_onboarding.tour_skipped,
    'login_count', v_onboarding.login_count,
    'first_login_at', v_onboarding.first_login_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_patient_onboarding(boolean, boolean) TO authenticated;

-- 5) RPC: Obter status do onboarding
CREATE OR REPLACE FUNCTION public.get_patient_onboarding_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_onboarding public.patient_onboarding%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('is_new', true);
  END IF;

  SELECT * INTO v_onboarding
  FROM public.patient_onboarding
  WHERE patient_user_id = v_patient_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_new', true, 'show_tour', true);
  END IF;

  RETURN jsonb_build_object(
    'is_new', false,
    'show_tour', NOT v_onboarding.tour_completed AND NOT v_onboarding.tour_skipped,
    'tour_completed', v_onboarding.tour_completed,
    'login_count', v_onboarding.login_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_onboarding_status() TO authenticated;

-- 6) RPC: Obter dependentes do paciente
CREATE OR REPLACE FUNCTION public.get_patient_dependents()
RETURNS TABLE (
  id uuid,
  dependent_id uuid,
  dependent_name text,
  relationship text,
  birth_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  SELECT 
    pd.id,
    pd.dependent_client_id as dependent_id,
    c.name as dependent_name,
    pd.relationship,
    c.birth_date
  FROM public.patient_dependents pd
  JOIN public.clients c ON c.id = pd.dependent_client_id
  WHERE pd.parent_client_id = v_client_id AND pd.is_active = true
  ORDER BY c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_dependents() TO authenticated;

-- 7) RPC: Obter conquistas do paciente
CREATE OR REPLACE FUNCTION public.get_patient_achievements()
RETURNS TABLE (
  achievement_type text,
  achievement_name text,
  achieved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  RETURN QUERY
  SELECT 
    pa.achievement_type,
    pa.achievement_name,
    pa.achieved_at
  FROM public.patient_achievements pa
  WHERE pa.patient_user_id = v_patient_user_id
  ORDER BY pa.achieved_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_achievements() TO authenticated;

-- 8) RPC: Verificar e conceder conquistas
CREATE OR REPLACE FUNCTION public.check_patient_achievements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_new_achievements text[] := '{}';
  v_appointment_count integer;
  v_rating_count integer;
  v_document_count integer;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('new_achievements', v_new_achievements);
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('new_achievements', v_new_achievements);
  END IF;

  -- Primeira consulta
  SELECT COUNT(*) INTO v_appointment_count
  FROM public.appointments
  WHERE client_id = v_client_id AND status = 'completed';

  IF v_appointment_count >= 1 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_patient_user_id, 'first_appointment', 'Primeira Consulta')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Primeira Consulta'); END IF;
  END IF;

  -- 5 consultas
  IF v_appointment_count >= 5 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_patient_user_id, 'five_appointments', 'Paciente Frequente')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Paciente Frequente'); END IF;
  END IF;

  -- 10 consultas
  IF v_appointment_count >= 10 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_patient_user_id, 'ten_appointments', 'Paciente Fiel')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Paciente Fiel'); END IF;
  END IF;

  -- Avaliou atendimento
  SELECT COUNT(*) INTO v_rating_count
  FROM public.appointment_ratings
  WHERE patient_user_id = v_patient_user_id;

  IF v_rating_count >= 1 THEN
    INSERT INTO public.patient_achievements (patient_user_id, achievement_type, achievement_name)
    VALUES (v_patient_user_id, 'first_rating', 'Avaliador')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'Avaliador'); END IF;
  END IF;

  RETURN jsonb_build_object('new_achievements', v_new_achievements);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_patient_achievements() TO authenticated;

-- 9) RPC: Obter consultas pendentes de avaliação
CREATE OR REPLACE FUNCTION public.get_patient_pending_ratings()
RETURNS TABLE (
  appointment_id uuid,
  service_name text,
  professional_name text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  SELECT 
    a.id as appointment_id,
    s.name as service_name,
    p.full_name as professional_name,
    a.updated_at as completed_at
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.client_id = v_client_id
    AND a.status = 'completed'
    AND a.updated_at > now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_ratings ar WHERE ar.appointment_id = a.id
    )
  ORDER BY a.updated_at DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_pending_ratings() TO authenticated;
