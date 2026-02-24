-- ============================================================================
-- FASE 29D: Histórico Médico & Saúde (Portal do Paciente)
-- ============================================================================

-- 1) RPC: Obter timeline de saúde do paciente
CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  event_type text,
  event_date timestamptz,
  title text,
  description text,
  professional_name text,
  metadata jsonb
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
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  -- Consultas
  SELECT 
    a.id,
    'appointment'::text as event_type,
    a.scheduled_at as event_date,
    s.name as title,
    CASE 
      WHEN a.status = 'completed' THEN 'Consulta realizada'
      WHEN a.status = 'cancelled' THEN 'Consulta cancelada'
      ELSE 'Consulta agendada'
    END as description,
    p.full_name as professional_name,
    jsonb_build_object(
      'status', a.status,
      'duration_minutes', a.duration_minutes,
      'telemedicine', a.telemedicine
    ) as metadata
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.client_id = v_client_id AND a.tenant_id = v_tenant_id

  UNION ALL

  -- Receitas
  SELECT 
    r.id,
    'prescription'::text as event_type,
    r.created_at as event_date,
    'Receita Médica' as title,
    r.prescription as description,
    p.full_name as professional_name,
    jsonb_build_object(
      'type', r.type,
      'validity_days', r.validity_days
    ) as metadata
  FROM public.prescriptions r
  LEFT JOIN public.profiles p ON p.id = r.professional_id
  WHERE r.client_id = v_client_id AND r.tenant_id = v_tenant_id

  UNION ALL

  -- Exames/Laudos
  SELECT 
    e.id,
    'exam'::text as event_type,
    e.exam_date as event_date,
    e.exam_type as title,
    e.result as description,
    p.full_name as professional_name,
    jsonb_build_object(
      'status', e.status
    ) as metadata
  FROM public.exam_results e
  LEFT JOIN public.profiles p ON p.id = e.professional_id
  WHERE e.client_id = v_client_id AND e.tenant_id = v_tenant_id

  UNION ALL

  -- Atestados
  SELECT 
    mc.id,
    'certificate'::text as event_type,
    mc.created_at as event_date,
    'Atestado Médico' as title,
    mc.content as description,
    p.full_name as professional_name,
    jsonb_build_object(
      'type', mc.type,
      'days', mc.days
    ) as metadata
  FROM public.medical_certificates mc
  LEFT JOIN public.profiles p ON p.id = mc.professional_id
  WHERE mc.client_id = v_client_id AND mc.tenant_id = v_tenant_id

  ORDER BY event_date DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;

-- 2) RPC: Obter medicamentos em uso (receitas vigentes)
CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
RETURNS TABLE (
  id uuid,
  medication_name text,
  dosage text,
  prescription_date timestamptz,
  expiry_date date,
  professional_name text,
  is_expired boolean
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
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.prescription as medication_name,
    '' as dosage,
    r.created_at as prescription_date,
    (r.created_at::date + COALESCE(r.validity_days, 30)) as expiry_date,
    p.full_name as professional_name,
    (r.created_at::date + COALESCE(r.validity_days, 30)) < CURRENT_DATE as is_expired
  FROM public.prescriptions r
  LEFT JOIN public.profiles p ON p.id = r.professional_id
  WHERE r.client_id = v_client_id 
    AND r.tenant_id = v_tenant_id
    AND r.type IN ('simples', 'especial', 'antimicrobiano')
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_active_medications() TO authenticated;

-- 3) RPC: Obter alergias e condições do paciente
CREATE OR REPLACE FUNCTION public.get_patient_health_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_client public.clients%ROWTYPE;
  v_vital_signs jsonb;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT c.* INTO v_client
  FROM public.patient_profiles pp
  JOIN public.clients c ON c.id = pp.client_id
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  -- Obter últimos sinais vitais
  SELECT jsonb_build_object(
    'weight', mr.weight,
    'height', mr.height,
    'blood_pressure', mr.blood_pressure,
    'heart_rate', mr.heart_rate,
    'temperature', mr.temperature,
    'oxygen_saturation', mr.oxygen_saturation,
    'recorded_at', mr.created_at
  ) INTO v_vital_signs
  FROM public.medical_records mr
  WHERE mr.client_id = v_client.id
    AND (mr.weight IS NOT NULL OR mr.blood_pressure IS NOT NULL)
  ORDER BY mr.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'allergies', v_client.allergies,
    'blood_type', v_client.blood_type,
    'birth_date', v_client.birth_date,
    'gender', v_client.gender,
    'last_vital_signs', COALESCE(v_vital_signs, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_health_info() TO authenticated;

-- 4) RPC: Obter histórico de sinais vitais para gráfico
CREATE OR REPLACE FUNCTION public.get_patient_vital_signs_history(p_limit integer DEFAULT 20)
RETURNS TABLE (
  recorded_at timestamptz,
  weight numeric,
  height numeric,
  blood_pressure text,
  heart_rate integer,
  temperature numeric,
  oxygen_saturation integer,
  glucose numeric
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
    mr.created_at as recorded_at,
    mr.weight,
    mr.height,
    mr.blood_pressure,
    mr.heart_rate,
    mr.temperature,
    mr.oxygen_saturation,
    mr.glucose
  FROM public.medical_records mr
  WHERE mr.client_id = v_client_id
    AND (mr.weight IS NOT NULL OR mr.blood_pressure IS NOT NULL OR mr.heart_rate IS NOT NULL)
  ORDER BY mr.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_vital_signs_history(integer) TO authenticated;

-- 5) Tabela de vacinas do paciente
CREATE TABLE IF NOT EXISTS public.patient_vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  vaccine_name text NOT NULL,
  vaccine_code text,
  dose_number integer,
  batch_number text,
  manufacturer text,
  
  administered_at date NOT NULL,
  administered_by text,
  location text,
  
  next_dose_date date,
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_client ON public.patient_vaccinations(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_tenant ON public.patient_vaccinations(tenant_id);

ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_vaccinations_patient_select" ON public.patient_vaccinations;
CREATE POLICY "patient_vaccinations_patient_select" ON public.patient_vaccinations
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_vaccinations_tenant_all" ON public.patient_vaccinations;
CREATE POLICY "patient_vaccinations_tenant_all" ON public.patient_vaccinations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 6) RPC: Obter vacinas do paciente
CREATE OR REPLACE FUNCTION public.get_patient_vaccinations()
RETURNS TABLE (
  id uuid,
  vaccine_name text,
  dose_number integer,
  batch_number text,
  manufacturer text,
  administered_at date,
  administered_by text,
  next_dose_date date
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
    pv.id,
    pv.vaccine_name,
    pv.dose_number,
    pv.batch_number,
    pv.manufacturer,
    pv.administered_at,
    pv.administered_by,
    pv.next_dose_date
  FROM public.patient_vaccinations pv
  WHERE pv.client_id = v_client_id
  ORDER BY pv.administered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_vaccinations() TO authenticated;
