-- ============================================================================
-- FIX PARTE 2: Corrigir funções de Messages, Health e Engagement
-- ============================================================================

-- ============================================================================
-- FASE 29C: Corrigir funções de mensagens
-- ============================================================================

-- Corrigir RLS policies
DROP POLICY IF EXISTS "patient_messages_patient_select" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_select" ON public.patient_messages
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_messages_patient_insert" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_insert" ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'patient' AND
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RPC: Enviar mensagem do paciente
CREATE OR REPLACE FUNCTION public.send_patient_message(p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_client_name text;
  v_message_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_content IS NULL OR BTRIM(p_content) = '' THEN RAISE EXCEPTION 'Mensagem não pode estar vazia'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_client_id;

  INSERT INTO public.patient_messages (tenant_id, client_id, sender_type, sender_user_id, sender_name, content)
  VALUES (v_tenant_id, v_client_id, 'patient', v_user_id, v_client_name, BTRIM(p_content))
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- RPC: Obter mensagens do paciente
CREATE OR REPLACE FUNCTION public.get_patient_messages(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, sender_type text, sender_name text, content text, read_at timestamptz, created_at timestamptz
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

  -- Marcar mensagens da clínica como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;

  RETURN QUERY
  SELECT pm.id, pm.sender_type, pm.sender_name, pm.content, pm.read_at, pm.created_at
  FROM public.patient_messages pm
  WHERE pm.client_id = v_client_id
  ORDER BY pm.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- RPC: Contar mensagens não lidas
CREATE OR REPLACE FUNCTION public.get_patient_unread_messages_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.patient_messages pm
  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- FASE 29D: Corrigir funções de saúde
-- ============================================================================

-- Corrigir RLS de vacinas
DROP POLICY IF EXISTS "patient_vaccinations_patient_select" ON public.patient_vaccinations;
CREATE POLICY "patient_vaccinations_patient_select" ON public.patient_vaccinations
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RPC: Timeline de saúde
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
  -- Consultas
  SELECT a.id, 'appointment'::text, a.scheduled_at, 
    COALESCE(s.name, 'Consulta')::text,
    COALESCE(a.notes, '')::text,
    COALESCE(p.full_name, '')::text,
    jsonb_build_object('status', a.status, 'service_id', a.service_id)
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.client_id = v_client_id AND a.tenant_id = v_tenant_id AND a.status = 'completed'

  UNION ALL

  -- Receitas
  SELECT pr.id, 'prescription'::text, pr.created_at,
    'Receita Médica'::text,
    COALESCE(pr.medications::text, '')::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('type', 'prescription')
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.client_id = v_client_id AND pr.tenant_id = v_tenant_id

  UNION ALL

  -- Exames
  SELECT er.id, 'exam'::text, er.created_at,
    COALESCE(er.exam_name, 'Exame')::text,
    COALESCE(er.result_text, '')::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('status', er.status)
  FROM public.exam_results er
  LEFT JOIN public.profiles prof ON prof.id = er.requested_by
  WHERE er.client_id = v_client_id AND er.tenant_id = v_tenant_id

  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;

-- RPC: Medicamentos ativos
DROP FUNCTION IF EXISTS public.get_patient_active_medications();
CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
RETURNS TABLE (
  id uuid, medication_name text, dosage text, frequency text, 
  start_date date, end_date date, professional_name text, notes text
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
  SELECT pr.id, 
    (pr.medications->0->>'name')::text,
    (pr.medications->0->>'dosage')::text,
    (pr.medications->0->>'frequency')::text,
    pr.created_at::date,
    (pr.created_at + interval '30 days')::date,
    COALESCE(prof.full_name, '')::text,
    COALESCE(pr.instructions, '')::text
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.client_id = v_client_id AND pr.tenant_id = v_tenant_id
    AND pr.created_at > now() - interval '90 days'
  ORDER BY pr.created_at DESC;
END;
$$;

-- RPC: Info de saúde do paciente
CREATE OR REPLACE FUNCTION public.get_patient_health_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_client public.clients%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

  RETURN jsonb_build_object(
    'name', v_client.name,
    'birth_date', v_client.birth_date,
    'blood_type', v_client.blood_type,
    'gender', v_client.gender
  );
END;
$$;

-- RPC: Histórico de sinais vitais
DROP FUNCTION IF EXISTS public.get_patient_vital_signs_history(integer);
CREATE OR REPLACE FUNCTION public.get_patient_vital_signs_history(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid, recorded_at timestamptz, weight numeric, height numeric,
  blood_pressure_systolic integer, blood_pressure_diastolic integer,
  heart_rate integer, temperature numeric, oxygen_saturation integer
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
  SELECT mr.id, mr.created_at as recorded_at, mr.weight_kg as weight, mr.height_cm::numeric as height,
    mr.blood_pressure_systolic, mr.blood_pressure_diastolic,
    mr.heart_rate, mr.temperature, mr.oxygen_saturation::integer
  FROM public.medical_records mr
  WHERE mr.client_id = v_client_id
    AND (mr.blood_pressure_systolic IS NOT NULL OR mr.heart_rate IS NOT NULL OR mr.weight_kg IS NOT NULL)
  ORDER BY mr.created_at DESC LIMIT p_limit;
END;
$$;

-- RPC: Vacinas do paciente
DROP FUNCTION IF EXISTS public.get_patient_vaccinations();
CREATE OR REPLACE FUNCTION public.get_patient_vaccinations()
RETURNS TABLE (
  id uuid, vaccine_name text, dose_number integer, applied_at date,
  next_dose_at date, lot_number text, manufacturer text, notes text
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
  SELECT pv.id, pv.vaccine_name, pv.dose_number, pv.administered_at as applied_at,
    pv.next_dose_date as next_dose_at, pv.batch_number as lot_number, pv.manufacturer, pv.notes
  FROM public.patient_vaccinations pv
  WHERE pv.client_id = v_client_id
  ORDER BY pv.administered_at DESC;
END;
$$;
