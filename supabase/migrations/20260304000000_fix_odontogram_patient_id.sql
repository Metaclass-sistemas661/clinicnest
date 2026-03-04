-- ============================================================
-- MIGRAÇÃO: Fix Odontogram RPCs — client_id → patient_id
-- Arquivo: 20260304000000_fix_odontogram_patient_id.sql
-- Descrição: Corrige todas as functions e views do odontograma
--   que ainda referenciavam o.client_id (renomeado para patient_id
--   na migration 20260330300000_rename_clients_to_patients_v1.sql).
-- Erro original: 42703 — column o.client_id does not exist
-- ============================================================

-- 1. FIX get_client_odontograms — SELECT usava o.client_id
-- ============================================================
DROP FUNCTION IF EXISTS public.get_client_odontograms(UUID, UUID);

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
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id,
    o.exam_date,
    o.notes,
    p.full_name as professional_name,
    (SELECT COUNT(*) FROM public.odontogram_teeth t WHERE t.odontogram_id = o.id) as tooth_count,
    o.created_at
  FROM public.odontograms o
  LEFT JOIN public.profiles p ON p.id = o.professional_id
  WHERE o.tenant_id = p_tenant_id
    AND o.patient_id = p_client_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_odontograms(UUID, UUID) TO authenticated;

-- 2. FIX create_odontogram_with_teeth — INSERT usava client_id column
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_odontogram_with_teeth(
  p_tenant_id UUID,
  p_client_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_exam_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_teeth JSONB DEFAULT '[]'::JSONB
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
  -- Verifica permissão
  IF NOT (
    public.is_tenant_admin(auth.uid(), p_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas dentistas podem criar odontogramas';
  END IF;

  -- Cria o odontograma (patient_id é o nome atual da coluna)
  INSERT INTO public.odontograms (
    tenant_id, patient_id, professional_id, appointment_id, exam_date, notes
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id, p_exam_date, p_notes
  ) RETURNING id INTO v_odontogram_id;

  -- Insere os dentes
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
      v_odontogram_id,
      (v_tooth->>'tooth_number')::INTEGER,
      COALESCE(v_tooth->>'condition', 'healthy'),
      v_tooth->>'surfaces',
      v_tooth->>'notes',
      (v_tooth->>'procedure_date')::DATE
    );
  END LOOP;

  RETURN v_odontogram_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_odontogram_with_teeth(UUID, UUID, UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- 3. FIX v_odontogram_summary view — usava o.client_id
-- ============================================================
DROP VIEW IF EXISTS public.v_odontogram_summary;

CREATE OR REPLACE VIEW public.v_odontogram_summary AS
SELECT 
  o.id as odontogram_id,
  o.tenant_id,
  o.patient_id,
  c.name as client_name,
  o.professional_id,
  p.full_name as professional_name,
  o.exam_date,
  o.notes,
  COUNT(t.id) as total_teeth,
  COUNT(t.id) FILTER (WHERE t.condition = 'healthy') as healthy_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'caries') as caries_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'restored') as restored_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'missing') as missing_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'crown') as crown_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'implant') as implant_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'endodontic') as endodontic_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'extraction') as extraction_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'prosthesis') as prosthesis_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'fracture') as fracture_count,
  o.created_at
FROM public.odontograms o
LEFT JOIN public.odontogram_teeth t ON t.odontogram_id = o.id
LEFT JOIN public.patients c ON c.id = o.patient_id
LEFT JOIN public.profiles p ON p.id = o.professional_id
GROUP BY o.id, o.tenant_id, o.patient_id, c.name, o.professional_id, p.full_name, o.exam_date, o.notes, o.created_at;

COMMENT ON VIEW public.v_odontogram_summary IS 'Resumo de odontogramas com contagem por condição';

-- 4. FIX indexes que podem ter ficado com nome antigo
-- ============================================================
DROP INDEX IF EXISTS idx_odontograms_tenant_client;
DROP INDEX IF EXISTS idx_odontograms_client_date;

CREATE INDEX IF NOT EXISTS idx_odontograms_tenant_patient 
  ON public.odontograms(tenant_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_odontograms_patient_date 
  ON public.odontograms(patient_id, exam_date DESC);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
