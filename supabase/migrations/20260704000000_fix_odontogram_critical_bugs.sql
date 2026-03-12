-- ============================================================
-- MIGRAÇÃO: Fix Critical Odontogram Bugs
-- Arquivo: 20260704000000_fix_odontogram_critical_bugs.sql
-- Descrição:
--   C1: RPC create_odontogram_with_teeth não salva mobility_grade e priority
--   C2: RPC get_client_odontograms não retorna dentition_type
--   C3: RPC create_odontogram_with_teeth não salva dentition_type
--   C5: treatment_plan_items.tooth_number CHECK exclui decíduos (51-85)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- PRE-REQ: Garantir que as colunas existem nas tabelas
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.odontograms
  ADD COLUMN IF NOT EXISTS dentition_type TEXT NOT NULL DEFAULT 'permanent';

ALTER TABLE public.odontogram_teeth
  ADD COLUMN IF NOT EXISTS mobility_grade INTEGER,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

-- ══════════════════════════════════════════════════════════════
-- C1 + C3: Fix create_odontogram_with_teeth
-- Adiciona dentition_type no INSERT do odontograma
-- Adiciona mobility_grade e priority no INSERT dos dentes
-- ══════════════════════════════════════════════════════════════

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
  -- Verifica permissão
  IF NOT (
    public.is_tenant_admin(auth.uid(), p_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas dentistas podem criar odontogramas';
  END IF;

  -- Cria o odontograma com dentition_type
  INSERT INTO public.odontograms (
    tenant_id, patient_id, professional_id, appointment_id, exam_date, notes, dentition_type
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id, p_exam_date, p_notes,
    COALESCE(p_dentition_type, 'permanent')
  ) RETURNING id INTO v_odontogram_id;

  -- Insere os dentes com mobility_grade e priority
  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)
  LOOP
    INSERT INTO public.odontogram_teeth (
      odontogram_id,
      tooth_number,
      condition,
      surfaces,
      notes,
      procedure_date,
      mobility_grade,
      priority
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

-- Revogar a antiga assinatura e garantir GRANT na nova
GRANT EXECUTE ON FUNCTION public.create_odontogram_with_teeth(UUID, UUID, UUID, UUID, DATE, TEXT, JSONB, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- C2: Fix get_client_odontograms — retornar dentition_type
-- ══════════════════════════════════════════════════════════════

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
  created_at TIMESTAMPTZ,
  dentition_type TEXT
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
    o.created_at,
    o.dentition_type
  FROM public.odontograms o
  LEFT JOIN public.profiles p ON p.id = o.professional_id
  WHERE o.tenant_id = p_tenant_id
    AND o.patient_id = p_client_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_odontograms(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- C5: Fix treatment_plan_items.tooth_number CHECK constraint
-- Expandir para incluir dentes decíduos (51-85) na validação
-- ══════════════════════════════════════════════════════════════

-- Remover constraint antiga
ALTER TABLE public.treatment_plan_items 
  DROP CONSTRAINT IF EXISTS treatment_plan_items_tooth_number_check;

-- Adicionar constraint que aceita permanentes (11-48) E decíduos (51-85)
ALTER TABLE public.treatment_plan_items
  ADD CONSTRAINT treatment_plan_items_tooth_number_check
    CHECK (
      tooth_number IS NULL
      OR (tooth_number BETWEEN 11 AND 48)
      OR (tooth_number BETWEEN 51 AND 85)
    );

COMMENT ON CONSTRAINT treatment_plan_items_tooth_number_check 
  ON public.treatment_plan_items 
  IS 'Aceita dentes permanentes (FDI 11-48) e decíduos (FDI 51-85)';

-- ══════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO
-- ══════════════════════════════════════════════════════════════
