-- ============================================================
-- MIGRAÇÃO: Fix Periogram & Treatment Plan RPCs after rename
-- Arquivo: 20260704100000_fix_periogram_treatment_rpcs_patient_id.sql
-- Descrição:
--   1. get_client_periograms → usa patient_id em vez de client_id
--   2. save_periogram_with_measurements → usa patient_id em vez de client_id
--   3. get_treatment_plan_with_items → JOIN public.patients em vez de clients
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. Fix get_client_periograms — p.client_id → p.patient_id
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_client_periograms(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  exam_date DATE,
  notes TEXT,
  plaque_index DECIMAL(5,2),
  bleeding_index DECIMAL(5,2),
  avg_probing_depth DECIMAL(4,2),
  sites_over_4mm INTEGER,
  sites_over_6mm INTEGER,
  total_sites INTEGER,
  periodontal_diagnosis TEXT,
  risk_classification TEXT,
  professional_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.exam_date,
    p.notes,
    p.plaque_index,
    p.bleeding_index,
    p.avg_probing_depth,
    p.sites_over_4mm,
    p.sites_over_6mm,
    p.total_sites,
    p.periodontal_diagnosis,
    p.risk_classification,
    pr.full_name AS professional_name,
    p.created_at
  FROM public.periograms p
  LEFT JOIN public.profiles pr ON p.professional_id = pr.id
  WHERE p.tenant_id = p_tenant_id
    AND p.patient_id = p_client_id
  ORDER BY p.exam_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_periograms(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2. Fix save_periogram_with_measurements — INSERT client_id → patient_id
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_periogram_with_measurements(
  p_tenant_id UUID,
  p_client_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_exam_date DATE,
  p_notes TEXT,
  p_periodontal_diagnosis TEXT,
  p_risk_classification TEXT,
  p_measurements JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periogram_id UUID;
  v_measurement JSONB;
BEGIN
  -- Criar periograma (coluna renomeada para patient_id)
  INSERT INTO public.periograms (
    tenant_id, patient_id, professional_id, appointment_id,
    exam_date, notes, periodontal_diagnosis, risk_classification, created_by
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id,
    p_exam_date, p_notes, p_periodontal_diagnosis, p_risk_classification, p_professional_id
  )
  RETURNING id INTO v_periogram_id;

  -- Inserir medições
  FOR v_measurement IN SELECT * FROM jsonb_array_elements(p_measurements)
  LOOP
    INSERT INTO public.periogram_measurements (
      periogram_id, tooth_number, site,
      probing_depth, recession, clinical_attachment_level,
      bleeding, suppuration, plaque, mobility, furcation
    ) VALUES (
      v_periogram_id,
      (v_measurement->>'tooth_number')::INTEGER,
      v_measurement->>'site',
      (v_measurement->>'probing_depth')::INTEGER,
      (v_measurement->>'recession')::INTEGER,
      (v_measurement->>'clinical_attachment_level')::INTEGER,
      COALESCE((v_measurement->>'bleeding')::BOOLEAN, FALSE),
      COALESCE((v_measurement->>'suppuration')::BOOLEAN, FALSE),
      COALESCE((v_measurement->>'plaque')::BOOLEAN, FALSE),
      (v_measurement->>'mobility')::INTEGER,
      (v_measurement->>'furcation')::INTEGER
    );
  END LOOP;

  -- Calcular índices
  PERFORM public.calculate_periogram_indices(v_periogram_id);

  RETURN v_periogram_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_periogram_with_measurements(UUID, UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3. Fix get_treatment_plan_with_items — JOIN patients em vez de clients
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_treatment_plan_with_items(p_plan_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan JSON;
  v_items JSON;
BEGIN
  SELECT row_to_json(p) INTO v_plan
  FROM (
    SELECT 
      tp.*,
      c.name as client_name,
      c.cpf as client_cpf,
      pr.full_name as professional_name,
      pr.council_number,
      pr.council_state
    FROM public.treatment_plans tp
    LEFT JOIN public.patients c ON c.id = tp.patient_id
    LEFT JOIN public.profiles pr ON pr.id = tp.professional_id
    WHERE tp.id = p_plan_id
  ) p;
  
  SELECT COALESCE(json_agg(i ORDER BY i.sort_order, i.tooth_number), '[]'::JSON) INTO v_items
  FROM public.treatment_plan_items i
  WHERE i.plan_id = p_plan_id;
  
  RETURN json_build_object('plan', v_plan, 'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_treatment_plan_with_items(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO
-- ══════════════════════════════════════════════════════════════
