-- GCP Migration: Functions - odontology
-- Total: 28 functions


-- ============================================
-- Function: get_client_odontograms
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_client_odontograms(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  exam_date DATE,
  notes TEXT,
  professional_name TEXT,
  tooth_count BIGINT,
  created_at TIMESTAMPTZ,
  dentition_type TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    o.id, o.exam_date, o.notes,
    p.full_name AS professional_name,
    (SELECT COUNT(*) FROM public.odontogram_teeth t WHERE t.odontogram_id = o.id),
    o.created_at,
    COALESCE(o.dentition_type, 'permanent') AS dentition_type
  FROM public.odontograms o
  LEFT JOIN public.profiles p ON p.id = o.professional_id
  WHERE o.tenant_id = p_tenant_id AND o.patient_id = p_client_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;


-- ============================================
-- Function: create_odontogram_with_teeth
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_odontogram_with_teeth(
  p_tenant_id UUID,
  p_client_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_exam_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_teeth JSONB DEFAULT '[]'::JSONB,
  p_dentition_type TEXT DEFAULT 'permanent'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_odontogram_id UUID;
  v_tooth JSONB;
BEGIN
  IF NOT (
    public.is_tenant_admin(auth.uid(), p_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas dentistas podem criar odontogramas';
  END IF;

  INSERT INTO public.odontograms (
    tenant_id, patient_id, professional_id, appointment_id, exam_date, notes, dentition_type
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id, p_exam_date, p_notes,
    COALESCE(p_dentition_type, 'permanent')
  ) RETURNING id INTO v_odontogram_id;

  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)
  LOOP
    INSERT INTO public.odontogram_teeth (
      odontogram_id, tooth_number, condition, surfaces, notes,
      procedure_date, mobility_grade, priority
    ) VALUES (
      v_odontogram_id,
      (v_tooth->>'tooth_number')::INTEGER,
      COALESCE(v_tooth->>'condition', 'healthy'),
      v_tooth->>'surfaces',
      v_tooth->>'notes',
      (v_tooth->>'procedure_date')::DATE,
      (v_tooth->>'mobility_grade')::INTEGER,
      COALESCE(v_tooth->>'priority', 'normal')
    );
  END LOOP;

  RETURN v_odontogram_id;
END;
$$;


-- ============================================
-- Function: get_tooth_evolution
-- Source: 20260304000001_odontogram_v2_expansion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tooth_evolution(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_tooth_number INTEGER
)
RETURNS TABLE (
  odontogram_id UUID,
  exam_date DATE,
  professional_name TEXT,
  condition TEXT,
  surfaces TEXT,
  notes TEXT,
  mobility_grade INTEGER,
  priority TEXT,
  procedure_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as odontogram_id,
    o.exam_date,
    p.full_name as professional_name,
    t.condition,
    t.surfaces,
    t.notes,
    t.mobility_grade,
    t.priority,
    t.procedure_date
  FROM public.odontograms o
  JOIN public.odontogram_teeth t ON t.odontogram_id = o.id AND t.tooth_number = p_tooth_number
  LEFT JOIN public.profiles p ON p.id = o.professional_id
  WHERE o.tenant_id = p_tenant_id
    AND o.patient_id = p_patient_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;


-- ============================================
-- Function: update_odontogram_inline
-- Source: 20260304000001_odontogram_v2_expansion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_odontogram_inline(
  p_odontogram_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_teeth JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tooth JSONB;
BEGIN
  -- Busca tenant
  SELECT tenant_id INTO v_tenant_id
  FROM public.odontograms WHERE id = p_odontogram_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Odontograma não encontrado';
  END IF;

  -- Verifica permissão
  IF NOT (
    public.is_tenant_admin(auth.uid(), v_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Atualiza notas se fornecido
  IF p_notes IS NOT NULL THEN
    UPDATE public.odontograms SET notes = p_notes, updated_at = NOW() WHERE id = p_odontogram_id;
  END IF;

  -- Upsert dentes
  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)
  LOOP
    INSERT INTO public.odontogram_teeth (
      odontogram_id, tooth_number, condition, surfaces, notes, 
      procedure_date, mobility_grade, priority
    ) VALUES (
      p_odontogram_id,
      (v_tooth->>'tooth_number')::INTEGER,
      COALESCE(v_tooth->>'condition', 'healthy'),
      v_tooth->>'surfaces',
      v_tooth->>'notes',
      (v_tooth->>'procedure_date')::DATE,
      (v_tooth->>'mobility_grade')::INTEGER,
      COALESCE(v_tooth->>'priority', 'normal')
    )
    ON CONFLICT (odontogram_id, tooth_number) DO UPDATE SET
      condition = EXCLUDED.condition,
      surfaces = EXCLUDED.surfaces,
      notes = EXCLUDED.notes,
      procedure_date = EXCLUDED.procedure_date,
      mobility_grade = EXCLUDED.mobility_grade,
      priority = EXCLUDED.priority,
      updated_at = NOW();
  END LOOP;
END;
$$;


-- ============================================
-- Function: compare_odontograms
-- Source: 20260304000001_odontogram_v2_expansion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.compare_odontograms(
  p_odontogram_id_1 UUID,
  p_odontogram_id_2 UUID
)
RETURNS TABLE (
  tooth_number INTEGER,
  condition_before TEXT,
  condition_after TEXT,
  surfaces_before TEXT,
  surfaces_after TEXT,
  changed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(t1.tooth_number, t2.tooth_number) as tooth_number,
    t1.condition as condition_before,
    t2.condition as condition_after,
    t1.surfaces as surfaces_before,
    t2.surfaces as surfaces_after,
    (t1.condition IS DISTINCT FROM t2.condition OR t1.surfaces IS DISTINCT FROM t2.surfaces) as changed
  FROM public.odontogram_teeth t1
  FULL OUTER JOIN public.odontogram_teeth t2 
    ON t1.tooth_number = t2.tooth_number AND t2.odontogram_id = p_odontogram_id_2
  WHERE t1.odontogram_id = p_odontogram_id_1
     OR t2.odontogram_id = p_odontogram_id_2
  ORDER BY COALESCE(t1.tooth_number, t2.tooth_number);
$$;


-- ============================================
-- Function: get_odontogram_teeth
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_odontogram_teeth(
  p_odontogram_id UUID
)
RETURNS TABLE (
  tooth_number INTEGER,
  condition TEXT,
  surfaces TEXT,
  notes TEXT,
  procedure_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    t.tooth_number,
    t.condition,
    t.surfaces,
    t.notes,
    t.procedure_date
  FROM public.odontogram_teeth t
  WHERE t.odontogram_id = p_odontogram_id
  ORDER BY t.tooth_number;
$$;


-- ============================================
-- Function: get_odontogram_stats
-- Source: 20260304000001_odontogram_v2_expansion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_odontogram_stats(
  p_tenant_id UUID,
  p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_latest_id UUID;
BEGIN
  -- Pega o odontograma mais recente
  SELECT id INTO v_latest_id
  FROM public.odontograms
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id
  ORDER BY exam_date DESC, created_at DESC
  LIMIT 1;

  IF v_latest_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_odontogram', false,
      'total_exams', 0
    );
  END IF;

  SELECT jsonb_build_object(
    'has_odontogram', true,
    'latest_odontogram_id', v_latest_id,
    'total_exams', (SELECT COUNT(*) FROM public.odontograms WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
    'total_teeth_registered', COUNT(*),
    'healthy', COUNT(*) FILTER (WHERE condition = 'healthy'),
    'caries', COUNT(*) FILTER (WHERE condition = 'caries'),
    'restored', COUNT(*) FILTER (WHERE condition = 'restored'),
    'missing', COUNT(*) FILTER (WHERE condition = 'missing'),
    'crown', COUNT(*) FILTER (WHERE condition = 'crown'),
    'implant', COUNT(*) FILTER (WHERE condition = 'implant'),
    'endodontic', COUNT(*) FILTER (WHERE condition = 'endodontic'),
    'extraction', COUNT(*) FILTER (WHERE condition = 'extraction'),
    'prosthesis', COUNT(*) FILTER (WHERE condition = 'prosthesis'),
    'fracture', COUNT(*) FILTER (WHERE condition = 'fracture'),
    'urgent_teeth', COUNT(*) FILTER (WHERE priority = 'urgent'),
    'high_priority_teeth', COUNT(*) FILTER (WHERE priority = 'high'),
    'mobility_teeth', COUNT(*) FILTER (WHERE mobility_grade > 0),
    'caries_rate_pct', ROUND(COUNT(*) FILTER (WHERE condition = 'caries')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
    'healthy_rate_pct', ROUND(COUNT(*) FILTER (WHERE condition = 'healthy')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1)
  ) INTO v_result
  FROM public.odontogram_teeth
  WHERE odontogram_id = v_latest_id;

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: get_client_treatment_plans
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_client_treatment_plans(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  plan_number TEXT,
  title TEXT,
  status TEXT,
  total_value DECIMAL,
  final_value DECIMAL,
  items_count BIGINT,
  items_completed BIGINT,
  professional_name TEXT,
  created_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 
    p.id,
    p.plan_number,
    p.title,
    p.status,
    p.total_value,
    p.final_value,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id) as items_count,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id AND i.status = 'concluido') as items_completed,
    pr.full_name as professional_name,
    p.created_at,
    p.approved_at
  FROM public.treatment_plans p
  LEFT JOIN public.profiles pr ON pr.id = p.professional_id
  WHERE p.tenant_id = p_tenant_id AND p.client_id = p_client_id
  ORDER BY p.created_at DESC;
$$;


-- ============================================
-- Function: get_treatment_plan_with_items
-- Source: 20260704100000_fix_periogram_treatment_rpcs_patient_id.sql
-- ============================================
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


-- ============================================
-- Function: get_client_dental_images
-- Source: 20260325000000_dental_images_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_client_dental_images(
  p_tenant_id UUID,
  p_client_id UUID,
  p_image_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  image_type TEXT,
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  tooth_numbers INTEGER[],
  description TEXT,
  clinical_notes TEXT,
  rx_technique TEXT,
  captured_at TIMESTAMPTZ,
  professional_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    di.id,
    di.image_type,
    di.file_name,
    di.file_path,
    di.file_size,
    di.mime_type,
    di.tooth_numbers,
    di.description,
    di.clinical_notes,
    di.rx_technique,
    di.captured_at,
    p.full_name AS professional_name
  FROM dental_images di
  LEFT JOIN profiles p ON di.professional_id = p.id
  WHERE di.tenant_id = p_tenant_id
    AND di.client_id = p_client_id
    AND (p_image_type IS NULL OR di.image_type = p_image_type)
  ORDER BY di.captured_at DESC;
END;
$$;


-- ============================================
-- Function: update_odontogram_updated_at
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_odontogram_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: upsert_odontogram_teeth
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_odontogram_teeth(
  p_odontogram_id UUID,
  p_teeth JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tooth JSONB;
  v_tenant_id UUID;
BEGIN
  -- Busca tenant_id do odontograma
  SELECT tenant_id INTO v_tenant_id
  FROM public.odontograms
  WHERE id = p_odontogram_id;

  -- Verifica permissão
  IF NOT (
    public.is_tenant_admin(auth.uid(), v_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas dentistas podem editar odontogramas';
  END IF;

  -- Remove dentes existentes
  DELETE FROM public.odontogram_teeth WHERE odontogram_id = p_odontogram_id;

  -- Insere novos dentes
  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)
  LOOP
    INSERT INTO public.odontogram_teeth (
      odontogram_id,
      tooth_number,
      condition,
      surfaces,
      notes,
      procedure_date
    ) VALUES (
      p_odontogram_id,
      (v_tooth->>'tooth_number')::INTEGER,
      COALESCE(v_tooth->>'condition', 'healthy'),
      v_tooth->>'surfaces',
      v_tooth->>'notes',
      (v_tooth->>'procedure_date')::DATE
    );
  END LOOP;
END;
$$;


-- ============================================
-- Function: calculate_periogram_indices
-- Source: 20260325100000_periograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calculate_periogram_indices(p_periogram_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sites INTEGER;
  v_plaque_count INTEGER;
  v_bleeding_count INTEGER;
  v_avg_depth DECIMAL(4,2);
  v_sites_over_4 INTEGER;
  v_sites_over_6 INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE plaque = TRUE),
    COUNT(*) FILTER (WHERE bleeding = TRUE),
    AVG(probing_depth),
    COUNT(*) FILTER (WHERE probing_depth > 4),
    COUNT(*) FILTER (WHERE probing_depth > 6)
  INTO 
    v_total_sites,
    v_plaque_count,
    v_bleeding_count,
    v_avg_depth,
    v_sites_over_4,
    v_sites_over_6
  FROM periogram_measurements
  WHERE periogram_id = p_periogram_id
    AND probing_depth IS NOT NULL;

  UPDATE periograms
  SET 
    total_sites = v_total_sites,
    plaque_index = CASE WHEN v_total_sites > 0 THEN (v_plaque_count::DECIMAL / v_total_sites) * 100 ELSE 0 END,
    bleeding_index = CASE WHEN v_total_sites > 0 THEN (v_bleeding_count::DECIMAL / v_total_sites) * 100 ELSE 0 END,
    avg_probing_depth = COALESCE(v_avg_depth, 0),
    sites_over_4mm = v_sites_over_4,
    sites_over_6mm = v_sites_over_6,
    updated_at = NOW()
  WHERE id = p_periogram_id;
END;
$$;


-- ============================================
-- Function: get_client_periograms
-- Source: 20260704100000_fix_periogram_treatment_rpcs_patient_id.sql
-- ============================================
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


-- ============================================
-- Function: get_periogram_measurements
-- Source: 20260325100000_periograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_periogram_measurements(p_periogram_id UUID)
RETURNS TABLE (
  tooth_number INTEGER,
  site TEXT,
  probing_depth INTEGER,
  recession INTEGER,
  clinical_attachment_level INTEGER,
  bleeding BOOLEAN,
  suppuration BOOLEAN,
  plaque BOOLEAN,
  mobility INTEGER,
  furcation INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.tooth_number,
    pm.site,
    pm.probing_depth,
    pm.recession,
    pm.clinical_attachment_level,
    pm.bleeding,
    pm.suppuration,
    pm.plaque,
    pm.mobility,
    pm.furcation
  FROM periogram_measurements pm
  JOIN periograms p ON pm.periogram_id = p.id
  WHERE pm.periogram_id = p_periogram_id
    AND p.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ORDER BY pm.tooth_number, 
    CASE pm.site 
      WHEN 'MV' THEN 1 WHEN 'V' THEN 2 WHEN 'DV' THEN 3 
      WHEN 'ML' THEN 4 WHEN 'L' THEN 5 WHEN 'DL' THEN 6 
    END;
END;
$$;


-- ============================================
-- Function: save_periogram_with_measurements
-- Source: 20260704100000_fix_periogram_treatment_rpcs_patient_id.sql
-- ============================================
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


-- ============================================
-- Function: update_treatment_plan_updated_at
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_treatment_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: recalculate_treatment_plan_totals
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.recalculate_treatment_plan_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total DECIMAL(12,2);
  v_plan_discount DECIMAL(5,2);
  v_discount_val DECIMAL(12,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_total
  FROM public.treatment_plan_items
  WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  SELECT discount_percent INTO v_plan_discount
  FROM public.treatment_plans
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  v_discount_val := v_total * COALESCE(v_plan_discount, 0) / 100;
  
  UPDATE public.treatment_plans
  SET 
    total_value = v_total,
    discount_value = v_discount_val,
    final_value = v_total - v_discount_val
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: approve_treatment_plan
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_treatment_plan(
  p_plan_id UUID,
  p_signature TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.treatment_plans
  SET 
    status = 'aprovado',
    approved_at = NOW(),
    approved_by_client = TRUE,
    client_signature = p_signature,
    signature_ip = p_ip
  WHERE id = p_plan_id AND status IN ('pendente', 'apresentado');
END;
$$;


-- ============================================
-- Function: complete_treatment_plan_item
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_treatment_plan_item(
  p_item_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan_id UUID;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  UPDATE public.treatment_plan_items
  SET 
    status = 'concluido',
    completed_at = NOW(),
    completed_by = auth.uid(),
    notes = COALESCE(p_notes, notes)
  WHERE id = p_item_id
  RETURNING plan_id INTO v_plan_id;
  
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluido')
  INTO v_total_items, v_completed_items
  FROM public.treatment_plan_items
  WHERE plan_id = v_plan_id;
  
  IF v_completed_items = v_total_items THEN
    UPDATE public.treatment_plans SET status = 'concluido' WHERE id = v_plan_id;
  ELSIF v_completed_items > 0 THEN
    UPDATE public.treatment_plans SET status = 'em_andamento' WHERE id = v_plan_id AND status = 'aprovado';
  END IF;
END;
$$;


-- ============================================
-- Function: get_treatment_plan_progress
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_treatment_plan_progress(p_plan_id UUID)
RETURNS JSON LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_items', COUNT(*),
    'completed_items', COUNT(*) FILTER (WHERE status = 'concluido'),
    'pending_items', COUNT(*) FILTER (WHERE status = 'pendente'),
    'scheduled_items', COUNT(*) FILTER (WHERE status = 'agendado'),
    'in_progress_items', COUNT(*) FILTER (WHERE status = 'em_andamento'),
    'cancelled_items', COUNT(*) FILTER (WHERE status = 'cancelado'),
    'completion_percent', CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'concluido')::DECIMAL / COUNT(*)) * 100, 1)
      ELSE 0 END,
    'total_value', SUM(total_price),
    'completed_value', SUM(total_price) FILTER (WHERE status = 'concluido')
  )
  FROM public.treatment_plan_items
  WHERE plan_id = p_plan_id;
$$;


-- ============================================
-- Function: refresh_dental_stats
-- Source: 20260719000000_dental_module_enhancements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_dental_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dental_stats;
END;
$$;


-- ============================================
-- Function: log_odontogram_tooth_change
-- Source: 20260719000000_dental_module_enhancements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.log_odontogram_tooth_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.condition IS DISTINCT FROM NEW.condition OR
    OLD.surfaces IS DISTINCT FROM NEW.surfaces OR
    OLD.notes IS DISTINCT FROM NEW.notes
  ) THEN
    INSERT INTO public.odontogram_tooth_history (
      odontogram_id, tooth_number,
      previous_condition, new_condition,
      previous_surfaces, new_surfaces,
      previous_notes, new_notes,
      changed_by
    ) VALUES (
      NEW.odontogram_id, NEW.tooth_number,
      OLD.condition, NEW.condition,
      OLD.surfaces, NEW.surfaces,
      OLD.notes, NEW.notes,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_tooth_history
-- Source: 20260719000000_dental_module_enhancements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tooth_history(
  p_odontogram_id UUID,
  p_tooth_number INTEGER
)
RETURNS TABLE (
  id UUID,
  previous_condition TEXT,
  new_condition TEXT,
  previous_surfaces TEXT,
  new_surfaces TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ,
  change_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.previous_condition,
    h.new_condition,
    h.previous_surfaces,
    h.new_surfaces,
    h.changed_by,
    p.full_name AS changed_by_name,
    h.changed_at,
    h.change_reason
  FROM public.odontogram_tooth_history h
  JOIN public.profiles p ON p.id = h.changed_by
  JOIN public.odontograms o ON o.id = h.odontogram_id
  WHERE h.odontogram_id = p_odontogram_id
    AND h.tooth_number = p_tooth_number
    AND o.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY h.changed_at DESC;
END;
$$;


-- ============================================
-- Function: get_dental_dashboard
-- Source: 20260719000000_dental_module_enhancements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dental_dashboard(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verify access
  IF public.get_user_tenant_id(auth.uid()) != p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'teeth_treated', (
      SELECT COUNT(DISTINCT ot.tooth_number) 
      FROM odontograms o 
      JOIN odontogram_teeth ot ON ot.odontogram_id = o.id
      WHERE o.tenant_id = p_tenant_id 
        AND o.exam_date BETWEEN p_start_date AND p_end_date
        AND ot.condition != 'healthy'
    ),
    'odontograms_created', (
      SELECT COUNT(*) FROM odontograms 
      WHERE tenant_id = p_tenant_id 
        AND exam_date BETWEEN p_start_date AND p_end_date
    ),
    'periograms_created', (
      SELECT COUNT(*) FROM periograms 
      WHERE tenant_id = p_tenant_id 
        AND exam_date BETWEEN p_start_date AND p_end_date
    ),
    'plans_pending', (
      SELECT COUNT(*) FROM treatment_plans 
      WHERE tenant_id = p_tenant_id 
        AND status IN ('pendente', 'apresentado')
    ),
    'plans_in_progress', (
      SELECT COUNT(*) FROM treatment_plans 
      WHERE tenant_id = p_tenant_id 
        AND status = 'em_andamento'
    ),
    'plans_completed', (
      SELECT COUNT(*) FROM treatment_plans 
      WHERE tenant_id = p_tenant_id 
        AND status = 'concluido'
        AND updated_at >= p_start_date
    ),
    'top_conditions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('condition', condition, 'count', cnt)), '[]')
      FROM (
        SELECT ot.condition, COUNT(*) AS cnt
        FROM odontograms o
        JOIN odontogram_teeth ot ON ot.odontogram_id = o.id
        WHERE o.tenant_id = p_tenant_id
          AND o.exam_date BETWEEN p_start_date AND p_end_date
          AND ot.condition != 'healthy'
        GROUP BY ot.condition
        ORDER BY cnt DESC
        LIMIT 10
      ) sub
    ),
    'urgent_teeth', (
      SELECT COUNT(*) 
      FROM odontograms o
      JOIN odontogram_teeth ot ON ot.odontogram_id = o.id
      WHERE o.tenant_id = p_tenant_id
        AND ot.priority = 'urgent'
        AND o.id IN (
          SELECT DISTINCT ON (o2.client_id) o2.id 
          FROM odontograms o2 
          WHERE o2.tenant_id = p_tenant_id
          ORDER BY o2.client_id, o2.exam_date DESC
        )
    )
  ) INTO result;

  RETURN result;
END;
$$;


-- ============================================
-- Function: calc_periogram_cal
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calc_periogram_cal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.probing_depth IS NOT NULL AND NEW.recession IS NOT NULL THEN
    NEW.clinical_attachment_level := NEW.probing_depth + NEW.recession;
  ELSE
    NEW.clinical_attachment_level := NULL;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: seed_tuss_odonto_defaults
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_tuss_odonto_defaults(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tuss_odonto_prices (tenant_id, tuss_code, description, default_price, category)
  VALUES
    -- CONSULTA / URGÊNCIA
    (p_tenant_id, '81000065', 'Consulta odontológica inicial', 150.00, 'Consulta'),
    (p_tenant_id, '81000073', 'Consulta odontológica de retorno', 100.00, 'Consulta'),
    (p_tenant_id, '81000081', 'Consulta odontológica para fins de perícia', 200.00, 'Consulta'),
    (p_tenant_id, '81000090', 'Consulta odontológica de urgência', 200.00, 'Urgência'),
    (p_tenant_id, '81000103', 'Consulta odontológica para avaliação técnica', 120.00, 'Consulta'),
    (p_tenant_id, '81000111', 'Consulta odontológica de acompanhamento', 100.00, 'Consulta'),
    (p_tenant_id, '81000120', 'Consulta odontológica domiciliar', 250.00, 'Consulta'),
    -- RADIOLOGIA
    (p_tenant_id, '81000200', 'Radiografia periapical completa (14 filmes)', 180.00, 'Radiologia'),
    (p_tenant_id, '81000219', 'Radiografia periapical (por filme)', 40.00, 'Radiologia'),
    (p_tenant_id, '81000227', 'Radiografia panorâmica', 120.00, 'Radiologia'),
    (p_tenant_id, '81000235', 'Radiografia interproximal (bite-wing)', 40.00, 'Radiologia'),
    (p_tenant_id, '81000243', 'Radiografia oclusal', 50.00, 'Radiologia'),
    (p_tenant_id, '81000251', 'Telerradiografia lateral', 100.00, 'Radiologia'),
    (p_tenant_id, '81000260', 'Telerradiografia frontal (PA)', 100.00, 'Radiologia'),
    (p_tenant_id, '81000278', 'Tomografia cone beam - por arcada', 350.00, 'Radiologia'),
    (p_tenant_id, '81000286', 'Tomografia cone beam - face total', 500.00, 'Radiologia'),
    (p_tenant_id, '81000294', 'Radiografia da ATM bilateral', 150.00, 'Radiologia'),
    (p_tenant_id, '81000308', 'Documentação ortodôntica completa', 350.00, 'Radiologia'),
    (p_tenant_id, '81000340', 'Escaneamento intraoral digital', 200.00, 'Radiologia'),
    -- PREVENÇÃO
    (p_tenant_id, '81100013', 'Profilaxia / limpeza dental (por arcada)', 150.00, 'Prevenção'),
    (p_tenant_id, '81100021', 'Aplicação tópica de flúor (por arcada)', 60.00, 'Prevenção'),
    (p_tenant_id, '81100030', 'Aplicação de selante de fissura (por dente)', 80.00, 'Prevenção'),
    (p_tenant_id, '81100048', 'Controle de placa bacteriana', 60.00, 'Prevenção'),
    (p_tenant_id, '81100056', 'Orientação de higiene bucal', 50.00, 'Prevenção'),
    (p_tenant_id, '81100080', 'Polimento coronário', 100.00, 'Prevenção'),
    (p_tenant_id, '81100099', 'Aplicação de cariostático (por dente)', 30.00, 'Prevenção'),
    -- DENTÍSTICA
    (p_tenant_id, '82000018', 'Restauração em ionômero de vidro - 1 face', 100.00, 'Dentística'),
    (p_tenant_id, '82000026', 'Restauração em ionômero de vidro - 2+ faces', 150.00, 'Dentística'),
    (p_tenant_id, '82000034', 'Restauração direta em resina composta - 1 face', 180.00, 'Dentística'),
    (p_tenant_id, '82000042', 'Restauração direta em resina composta - 2 faces', 250.00, 'Dentística'),
    (p_tenant_id, '82000050', 'Restauração direta em resina composta - 3 faces', 320.00, 'Dentística'),
    (p_tenant_id, '82000069', 'Restauração direta em resina composta - 4+ faces', 380.00, 'Dentística'),
    (p_tenant_id, '82000077', 'Restauração direta em amálgama - 1 face', 120.00, 'Dentística'),
    (p_tenant_id, '82000085', 'Restauração direta em amálgama - 2 faces', 160.00, 'Dentística'),
    (p_tenant_id, '82000093', 'Restauração direta em amálgama - 3+ faces', 200.00, 'Dentística'),
    (p_tenant_id, '82000115', 'Restauração indireta inlay/onlay cerâmica', 800.00, 'Dentística'),
    (p_tenant_id, '82000123', 'Restauração indireta inlay/onlay resina', 600.00, 'Dentística'),
    (p_tenant_id, '82000174', 'Tratamento restaurador atraumático (ART)', 120.00, 'Dentística'),
    (p_tenant_id, '82000182', 'Núcleo de preenchimento em resina', 200.00, 'Dentística'),
    (p_tenant_id, '82000190', 'Núcleo metálico fundido', 350.00, 'Dentística'),
    (p_tenant_id, '82000204', 'Pino intrarradicular pré-fabricado', 200.00, 'Dentística'),
    (p_tenant_id, '82000212', 'Pino de fibra de vidro', 300.00, 'Dentística'),
    (p_tenant_id, '82000220', 'Ajuste oclusal por desgaste seletivo', 100.00, 'Dentística'),
    (p_tenant_id, '82000239', 'Colagem de fragmento dental', 200.00, 'Dentística'),
    (p_tenant_id, '82000247', 'Restauração provisória / temporária', 80.00, 'Dentística'),
    -- ENDODONTIA
    (p_tenant_id, '83000014', 'Tratamento de canal unirradicular', 600.00, 'Endodontia'),
    (p_tenant_id, '83000022', 'Tratamento de canal birradicular', 800.00, 'Endodontia'),
    (p_tenant_id, '83000030', 'Tratamento de canal multirradicular (3+ canais)', 1000.00, 'Endodontia'),
    (p_tenant_id, '83000049', 'Retratamento endodôntico unirradicular', 700.00, 'Endodontia'),
    (p_tenant_id, '83000057', 'Retratamento endodôntico birradicular', 900.00, 'Endodontia'),
    (p_tenant_id, '83000065', 'Retratamento endodôntico multirradicular', 1200.00, 'Endodontia'),
    (p_tenant_id, '83000073', 'Pulpotomia', 200.00, 'Endodontia'),
    (p_tenant_id, '83000081', 'Pulpectomia (dente decíduo)', 250.00, 'Endodontia'),
    (p_tenant_id, '83000090', 'Capeamento pulpar direto', 120.00, 'Endodontia'),
    (p_tenant_id, '83000103', 'Capeamento pulpar indireto', 100.00, 'Endodontia'),
    (p_tenant_id, '83000111', 'Remoção de corpo estranho do canal', 350.00, 'Endodontia'),
    (p_tenant_id, '83000120', 'Remoção de instrumento fraturado do canal', 500.00, 'Endodontia'),
    (p_tenant_id, '83000138', 'Apicectomia unirradicular', 500.00, 'Endodontia'),
    (p_tenant_id, '83000170', 'Curativo de demora (medicação intracanal)', 100.00, 'Endodontia'),
    (p_tenant_id, '83000189', 'Clareamento interno (dente desvitalizado)', 250.00, 'Endodontia'),
    (p_tenant_id, '83000197', 'Tratamento de perfuração radicular (MTA)', 400.00, 'Endodontia'),
    (p_tenant_id, '83000219', 'Remoção de pino intrarradicular', 300.00, 'Endodontia'),
    (p_tenant_id, '83000227', 'Drenagem de abscesso dentoalveolar', 180.00, 'Endodontia'),
    -- PERIODONTIA
    (p_tenant_id, '84000010', 'Raspagem supragengival (por hemiarcada)', 200.00, 'Periodontia'),
    (p_tenant_id, '84000028', 'Raspagem subgengival (por hemiarcada)', 250.00, 'Periodontia'),
    (p_tenant_id, '84000036', 'Raspagem supra e subgengival (boca toda)', 500.00, 'Periodontia'),
    (p_tenant_id, '84000044', 'Cirurgia periodontal a retalho (sextante)', 500.00, 'Periodontia'),
    (p_tenant_id, '84000052', 'Gengivectomia (por sextante)', 400.00, 'Periodontia'),
    (p_tenant_id, '84000060', 'Gengivoplastia (por sextante)', 400.00, 'Periodontia'),
    (p_tenant_id, '84000079', 'Aumento de coroa clínica (por dente)', 500.00, 'Periodontia'),
    (p_tenant_id, '84000087', 'Enxerto gengival livre', 800.00, 'Periodontia'),
    (p_tenant_id, '84000095', 'Enxerto de tecido conjuntivo', 1000.00, 'Periodontia'),
    (p_tenant_id, '84000109', 'Recobrimento radicular', 900.00, 'Periodontia'),
    (p_tenant_id, '84000117', 'Regeneração tecidual guiada (RTG)', 1200.00, 'Periodontia'),
    (p_tenant_id, '84000125', 'Enxerto ósseo periodontal', 800.00, 'Periodontia'),
    (p_tenant_id, '84000141', 'Contenção periodontal (arcada)', 300.00, 'Periodontia'),
    (p_tenant_id, '84000150', 'Frenectomia labial', 350.00, 'Periodontia'),
    (p_tenant_id, '84000168', 'Frenectomia lingual', 350.00, 'Periodontia'),
    (p_tenant_id, '84000184', 'Imobilização dental temporária', 250.00, 'Periodontia'),
    (p_tenant_id, '84000192', 'Manutenção periodontal (sessão)', 200.00, 'Periodontia'),
    (p_tenant_id, '84000206', 'Sondagem periodontal (periograma)', 100.00, 'Periodontia'),
    -- CIRURGIA
    (p_tenant_id, '85000016', 'Exodontia simples (dente permanente)', 200.00, 'Cirurgia'),
    (p_tenant_id, '85000024', 'Exodontia simples de dente decíduo', 120.00, 'Cirurgia'),
    (p_tenant_id, '85000032', 'Exodontia de dente incluso/impactado', 500.00, 'Cirurgia'),
    (p_tenant_id, '85000040', 'Exodontia de dente semi-incluso', 400.00, 'Cirurgia'),
    (p_tenant_id, '85000059', 'Exodontia com odontosecção', 400.00, 'Cirurgia'),
    (p_tenant_id, '85000067', 'Exodontia de raiz residual', 250.00, 'Cirurgia'),
    (p_tenant_id, '85000075', 'Exodontia múltipla (por arcada)', 500.00, 'Cirurgia'),
    (p_tenant_id, '85000083', 'Alveoloplastia (por arcada)', 350.00, 'Cirurgia'),
    (p_tenant_id, '85000091', 'Remoção de dente supranumerário', 400.00, 'Cirurgia'),
    (p_tenant_id, '85000113', 'Frenectomia cirúrgica', 350.00, 'Cirurgia'),
    (p_tenant_id, '85000121', 'Reimplante dental', 350.00, 'Cirurgia'),
    (p_tenant_id, '85000148', 'Sutura de ferida bucal', 150.00, 'Cirurgia'),
    (p_tenant_id, '85000156', 'Remoção de cisto periapical', 600.00, 'Cirurgia'),
    (p_tenant_id, '85000180', 'Incisão e drenagem de abscesso bucal', 200.00, 'Cirurgia'),
    (p_tenant_id, '85000261', 'Remoção de torus palatino', 600.00, 'Cirurgia'),
    (p_tenant_id, '85000270', 'Remoção de torus mandibular', 600.00, 'Cirurgia'),
    (p_tenant_id, '85000296', 'Biópsia de tecido mole da boca', 300.00, 'Cirurgia'),
    (p_tenant_id, '85000318', 'Regularização de rebordo alveolar', 400.00, 'Cirurgia'),
    (p_tenant_id, '85000326', 'Remoção de mucocele', 350.00, 'Cirurgia'),
    (p_tenant_id, '85000415', 'Enxerto ósseo autógeno intraoral', 1200.00, 'Cirurgia'),
    (p_tenant_id, '85000431', 'Enxerto ósseo com biomaterial', 800.00, 'Cirurgia'),
    (p_tenant_id, '85000440', 'Levantamento de seio maxilar lateral', 2000.00, 'Cirurgia'),
    (p_tenant_id, '85000458', 'Levantamento de seio maxilar crestal', 1500.00, 'Cirurgia'),
    (p_tenant_id, '85000504', 'Tracionamento de dente incluso (ortodontia)', 500.00, 'Cirurgia'),
    -- PRÓTESE
    (p_tenant_id, '86000012', 'Coroa total metalocerâmica', 1200.00, 'Prótese'),
    (p_tenant_id, '86000020', 'Coroa total em cerâmica pura (metal-free)', 1800.00, 'Prótese'),
    (p_tenant_id, '86000039', 'Coroa total metálica', 800.00, 'Prótese'),
    (p_tenant_id, '86000055', 'Coroa provisória em acrílico', 150.00, 'Prótese'),
    (p_tenant_id, '86000063', 'Prótese parcial fixa metalocerâmica (elemento)', 1200.00, 'Prótese'),
    (p_tenant_id, '86000071', 'Prótese parcial fixa cerâmica pura (elemento)', 1800.00, 'Prótese'),
    (p_tenant_id, '86000080', 'PPR com estrutura metálica', 1500.00, 'Prótese'),
    (p_tenant_id, '86000098', 'PPR provisória (acrílica)', 600.00, 'Prótese'),
    (p_tenant_id, '86000101', 'Prótese total superior (dentadura)', 2000.00, 'Prótese'),
    (p_tenant_id, '86000110', 'Prótese total inferior (dentadura)', 2000.00, 'Prótese'),
    (p_tenant_id, '86000136', 'Reembasamento de prótese', 350.00, 'Prótese'),
    (p_tenant_id, '86000152', 'Conserto de prótese removível', 200.00, 'Prótese'),
    (p_tenant_id, '86000160', 'Placa miorrelaxante (bruxismo)', 600.00, 'Prótese'),
    (p_tenant_id, '86000233', 'Bloco/coroa CAD-CAM cerâmica', 2000.00, 'Prótese'),
    -- ORTODONTIA
    (p_tenant_id, '87000019', 'Aparelho ortodôntico fixo metálico (arcada)', 1500.00, 'Ortodontia'),
    (p_tenant_id, '87000027', 'Aparelho ortodôntico fixo estético (arcada)', 2500.00, 'Ortodontia'),
    (p_tenant_id, '87000035', 'Aparelho ortodôntico fixo autoligado (arcada)', 3000.00, 'Ortodontia'),
    (p_tenant_id, '87000043', 'Alinhador transparente (fase)', 5000.00, 'Ortodontia'),
    (p_tenant_id, '87000051', 'Aparelho ortodôntico removível (arcada)', 600.00, 'Ortodontia'),
    (p_tenant_id, '87000060', 'Aparelho ortopédico funcional', 1200.00, 'Ortodontia'),
    (p_tenant_id, '87000078', 'Manutenção ortodôntica mensal', 250.00, 'Ortodontia'),
    (p_tenant_id, '87000086', 'Mini-implante ortodôntico', 500.00, 'Ortodontia'),
    (p_tenant_id, '87000108', 'Colagem de bracket/tubo (unidade)', 80.00, 'Ortodontia'),
    (p_tenant_id, '87000124', 'Remoção de aparelho fixo (arcada)', 200.00, 'Ortodontia'),
    (p_tenant_id, '87000132', 'Contenção fixa (barra lingual - arcada)', 300.00, 'Ortodontia'),
    (p_tenant_id, '87000140', 'Contenção removível Hawley (arcada)', 400.00, 'Ortodontia'),
    (p_tenant_id, '87000159', 'Disjuntor palatino', 1200.00, 'Ortodontia'),
    (p_tenant_id, '87000183', 'Mantenedor de espaço fixo', 350.00, 'Ortodontia'),
    -- IMPLANTODONTIA
    (p_tenant_id, '88000015', 'Implante osseointegrado (corpo)', 3000.00, 'Implantodontia'),
    (p_tenant_id, '88000023', 'Implante carga imediata', 4000.00, 'Implantodontia'),
    (p_tenant_id, '88000031', 'Reabertura de implante', 500.00, 'Implantodontia'),
    (p_tenant_id, '88000058', 'Componente protético / abutment', 800.00, 'Implantodontia'),
    (p_tenant_id, '88000074', 'Coroa sobre implante metalocerâmica', 2000.00, 'Implantodontia'),
    (p_tenant_id, '88000082', 'Coroa sobre implante cerâmica pura', 2800.00, 'Implantodontia'),
    (p_tenant_id, '88000090', 'Protocolo fixo sobre implantes (arcada)', 15000.00, 'Implantodontia'),
    (p_tenant_id, '88000112', 'Overdenture sobre implantes barra (arcada)', 8000.00, 'Implantodontia'),
    (p_tenant_id, '88000163', 'Enxerto ósseo para implante (biomaterial)', 800.00, 'Implantodontia'),
    (p_tenant_id, '88000171', 'Membrana para regeneração óssea', 500.00, 'Implantodontia'),
    (p_tenant_id, '88000180', 'Levantamento de seio para implante lateral', 2000.00, 'Implantodontia'),
    (p_tenant_id, '88000201', 'Guia cirúrgico para implante', 800.00, 'Implantodontia'),
    (p_tenant_id, '88000244', 'Manutenção de prótese sobre implante', 200.00, 'Implantodontia'),
    -- ESTÉTICA
    (p_tenant_id, '89000011', 'Clareamento de consultório (sessão)', 800.00, 'Estética'),
    (p_tenant_id, '89000020', 'Clareamento caseiro (kit)', 500.00, 'Estética'),
    (p_tenant_id, '89000038', 'Faceta direta em resina (dente)', 400.00, 'Estética'),
    (p_tenant_id, '89000054', 'Faceta indireta cerâmica/porcelana (dente)', 1500.00, 'Estética'),
    (p_tenant_id, '89000062', 'Lente de contato dental (laminado ultrafino)', 2000.00, 'Estética'),
    (p_tenant_id, '89000070', 'Gengivoplastia estética laser', 500.00, 'Estética'),
    (p_tenant_id, '89000089', 'Ensaio restaurador (mock-up)', 300.00, 'Estética'),
    (p_tenant_id, '89000097', 'Reanatomização dental em resina (dente)', 250.00, 'Estética'),
    (p_tenant_id, '89000100', 'Toxina botulínica perioral (HOF)', 1200.00, 'Estética'),
    (p_tenant_id, '89000119', 'Preenchimento ácido hialurônico perioral (HOF)', 1500.00, 'Estética'),
    (p_tenant_id, '89000127', 'Bichectomia', 2000.00, 'Estética'),
    -- ODONTOPEDIATRIA
    (p_tenant_id, '90000015', 'Pulpotomia em dente decíduo', 200.00, 'Odontopediatria'),
    (p_tenant_id, '90000023', 'Pulpectomia em dente decíduo', 250.00, 'Odontopediatria'),
    (p_tenant_id, '90000031', 'Exodontia de dente decíduo', 120.00, 'Odontopediatria'),
    (p_tenant_id, '90000040', 'Mantenedor de espaço fixo (banda-alça)', 350.00, 'Odontopediatria'),
    (p_tenant_id, '90000066', 'Coroa de aço em dente decíduo', 250.00, 'Odontopediatria'),
    (p_tenant_id, '90000082', 'Restauração decíduo com resina', 120.00, 'Odontopediatria'),
    (p_tenant_id, '90000090', 'Restauração decíduo com ionômero', 100.00, 'Odontopediatria'),
    (p_tenant_id, '90000155', 'Sedação consciente com óxido nitroso', 300.00, 'Odontopediatria'),
    -- DTM / OCLUSÃO
    (p_tenant_id, '91000011', 'Placa miorrelaxante (oclusal estabilizadora)', 600.00, 'DTM/Oclusão'),
    (p_tenant_id, '91000020', 'Placa reposicionadora para DTM', 700.00, 'DTM/Oclusão'),
    (p_tenant_id, '91000038', 'Ajuste oclusal por desgaste seletivo', 200.00, 'DTM/Oclusão'),
    (p_tenant_id, '91000054', 'Montagem em articulador semi-ajustável', 150.00, 'DTM/Oclusão'),
    (p_tenant_id, '91000070', 'Toxina botulínica para bruxismo/DTM', 1200.00, 'DTM/Oclusão'),
    -- ESTOMATOLOGIA
    (p_tenant_id, '92000017', 'Biópsia incisional de lesão oral', 300.00, 'Estomatologia'),
    (p_tenant_id, '92000025', 'Biópsia excisional de lesão oral', 400.00, 'Estomatologia'),
    (p_tenant_id, '92000041', 'Rastreio de câncer bucal', 100.00, 'Estomatologia'),
    (p_tenant_id, '92000050', 'Remoção de lesão de tecido mole', 350.00, 'Estomatologia'),
    (p_tenant_id, '92000076', 'Tratamento de lesão aftosa/herpes (laser)', 150.00, 'Estomatologia'),
    -- LASERTERAPIA
    (p_tenant_id, '93000013', 'Laserterapia de baixa potência (sessão)', 100.00, 'Laserterapia'),
    (p_tenant_id, '93000048', 'Laserterapia para hipersensibilidade', 100.00, 'Laserterapia'),
    (p_tenant_id, '93000056', 'Terapia fotodinâmica (PDT)', 200.00, 'Laserterapia'),
    (p_tenant_id, '93000064', 'Frenectomia a laser', 500.00, 'Laserterapia'),
    (p_tenant_id, '93000099', 'Clareamento assistido por laser', 1000.00, 'Laserterapia'),
    -- ANESTESIA / SEDAÇÃO
    (p_tenant_id, '95000016', 'Anestesia local (por procedimento)', 30.00, 'Anestesia'),
    (p_tenant_id, '95000032', 'Sedação consciente com óxido nitroso', 300.00, 'Anestesia'),
    (p_tenant_id, '95000040', 'Sedação consciente oral', 400.00, 'Anestesia'),
    -- OUTROS
    (p_tenant_id, '99000012', 'Moldagem de estudo (alginato por arcada)', 50.00, 'Outros'),
    (p_tenant_id, '99000020', 'Moldagem com silicone (por arcada)', 120.00, 'Outros'),
    (p_tenant_id, '99000039', 'Planejamento digital do sorriso (DSD)', 500.00, 'Outros'),
    (p_tenant_id, '99000071', 'Dessensibilização dentinária (sessão)', 80.00, 'Outros'),
    (p_tenant_id, '99000128', 'Tratamento de alveolite', 100.00, 'Outros'),
    (p_tenant_id, '99000144', 'Jateamento com bicarbonato (profilaxia a jato)', 200.00, 'Outros')
  ON CONFLICT (tenant_id, tuss_code) DO NOTHING;
END;
$$;


-- ============================================
-- Function: get_tuss_odonto_prices
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tuss_odonto_prices(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tuss_code TEXT,
  description TEXT,
  default_price NUMERIC,
  category TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, tuss_code, description, default_price, category, is_active
  FROM public.tuss_odonto_prices
  WHERE tenant_id = p_tenant_id AND is_active = true
  ORDER BY category, tuss_code;
$$;

