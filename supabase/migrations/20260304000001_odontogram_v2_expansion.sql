-- ============================================================
-- MIGRAÇÃO: Odontograma v2 — Expansão Professional
-- Arquivo: 20260304000001_odontogram_v2_expansion.sql
-- Descrição:
--   1. Adiciona suporte a dentição decídua (51-85)
--   2. Expande condições de dente (10 → 25+)
--   3. Adiciona tabela odontogram_tooth_surfaces (multi-condição por face)
--   4. Adiciona tabela odontogram_annotations (anotações livres)
--   5. Novas RPCs para edição inline e evolução por dente
-- ============================================================

-- ============================================================
-- 1. EXPANDIR CONSTRAINT DO TOOTH_NUMBER — incluir decíduos
-- ============================================================

-- Remove constraint antiga (11-48) e recria com decíduos (11-48 + 51-85)
ALTER TABLE public.odontogram_teeth DROP CONSTRAINT IF EXISTS odontogram_teeth_tooth_number_check;
ALTER TABLE public.odontogram_teeth ADD CONSTRAINT odontogram_teeth_tooth_number_check 
  CHECK (
    (tooth_number BETWEEN 11 AND 18) OR  -- Superior direito permanente
    (tooth_number BETWEEN 21 AND 28) OR  -- Superior esquerdo permanente
    (tooth_number BETWEEN 31 AND 38) OR  -- Inferior esquerdo permanente
    (tooth_number BETWEEN 41 AND 48) OR  -- Inferior direito permanente
    (tooth_number BETWEEN 51 AND 55) OR  -- Superior direito decíduo
    (tooth_number BETWEEN 61 AND 65) OR  -- Superior esquerdo decíduo
    (tooth_number BETWEEN 71 AND 75) OR  -- Inferior esquerdo decíduo
    (tooth_number BETWEEN 81 AND 85)     -- Inferior direito decíduo
  );

-- Adiciona coluna dentition_type ao odontograma (adulto vs infantil vs misto)
ALTER TABLE public.odontograms 
  ADD COLUMN IF NOT EXISTS dentition_type TEXT NOT NULL DEFAULT 'permanent'
  CHECK (dentition_type IN ('permanent', 'deciduous', 'mixed'));

COMMENT ON COLUMN public.odontograms.dentition_type IS 'Tipo de dentição: permanent (adulto 32 dentes), deciduous (infantil 20 dentes), mixed (misto)';

-- ============================================================
-- 2. EXPANDIR CONDIÇÕES DO DENTE
-- ============================================================

-- Drop antigo CHECK constraint e recria com condições expandidas
ALTER TABLE public.odontogram_teeth DROP CONSTRAINT IF EXISTS odontogram_teeth_condition_check;
ALTER TABLE public.odontogram_teeth ADD CONSTRAINT odontogram_teeth_condition_check
  CHECK (condition IN (
    -- Condições originais (10)
    'healthy',       -- Saudável / Hígido
    'caries',        -- Cárie
    'restored',      -- Restaurado
    'missing',       -- Ausente
    'crown',         -- Coroa protética
    'implant',       -- Implante
    'endodontic',    -- Tratamento endodôntico (canal)
    'extraction',    -- Indicado para extração
    'prosthesis',    -- Prótese
    'fracture',      -- Fratura
    -- Novas condições (15+)
    'sealant',       -- Selante
    'veneer',        -- Faceta
    'bridge',        -- Ponte fixa (elemento)
    'bridge_abutment', -- Pilar de ponte
    'temporary',     -- Restauração provisória
    'root_remnant',  -- Resto radicular
    'impacted',      -- Incluso / Impactado
    'supernumerary', -- Supranumerário
    'diastema',      -- Diastema
    'rotation',      -- Giroversão
    'ectopic',       -- Ectopia
    'abrasion',      -- Abrasão / Atrição
    'erosion',       -- Erosão
    'resorption',    -- Reabsorção
    'periapical',    -- Lesão periapical
    'mobility',      -- Mobilidade
    'recession',     -- Recessão gengival
    'fistula',       -- Fístula
    'abscess',       -- Abscesso
    'unerupted',     -- Não erupcionado
    'semi_erupted',  -- Semi-erupcionado
    'deciduous',     -- Dente decíduo presente
    'agenesis'       -- Agenesia (dente nunca existiu)
  ));

-- Adiciona coluna de mobilidade (grau 0-3)
ALTER TABLE public.odontogram_teeth
  ADD COLUMN IF NOT EXISTS mobility_grade INTEGER DEFAULT NULL
  CHECK (mobility_grade IS NULL OR (mobility_grade BETWEEN 0 AND 3));

-- Adiciona coluna de urgência/prioridade
ALTER TABLE public.odontogram_teeth
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('normal', 'low', 'high', 'urgent'));

COMMENT ON COLUMN public.odontogram_teeth.mobility_grade IS 'Grau de mobilidade (0=firme, 1=leve, 2=moderada, 3=severa)';
COMMENT ON COLUMN public.odontogram_teeth.priority IS 'Prioridade de tratamento: normal, low, high, urgent';

-- ============================================================
-- 3. TABELA DE CONDIÇÕES POR FACE (multi-condição por superfície)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.odontogram_tooth_surfaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odontogram_tooth_id UUID NOT NULL REFERENCES public.odontogram_teeth(id) ON DELETE CASCADE,
  surface         TEXT NOT NULL CHECK (surface IN ('V', 'L', 'M', 'D', 'O', 'I', 'P', 'C')),
  -- V=Vestibular, L=Lingual, M=Mesial, D=Distal, O=Oclusal, I=Incisal, P=Palatina, C=Cervical
  condition       TEXT NOT NULL DEFAULT 'healthy' CHECK (condition IN (
    'healthy', 'caries', 'restored', 'fracture', 'sealant', 'veneer',
    'temporary', 'abrasion', 'erosion', 'crown', 'bridge'
  )),
  material        TEXT, -- Ex: 'resina', 'amálgama', 'cerâmica', 'ionômero de vidro'
  color_shade     TEXT, -- Cor do material (A1, A2, B1, etc.)
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (odontogram_tooth_id, surface)
);

COMMENT ON TABLE public.odontogram_tooth_surfaces IS 'Condição específica por face/superfície do dente — permite múltiplas condições por dente';
COMMENT ON COLUMN public.odontogram_tooth_surfaces.material IS 'Material utilizado: resina, amálgama, cerâmica, ionômero, etc.';

ALTER TABLE public.odontogram_tooth_surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_tooth_surfaces FORCE ROW LEVEL SECURITY;

-- RLS herda do tooth (que herda do odontogram)
DROP POLICY IF EXISTS "odontogram_surfaces_select" ON public.odontogram_tooth_surfaces;
CREATE POLICY "odontogram_surfaces_select" ON public.odontogram_tooth_surfaces
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "odontogram_surfaces_insert" ON public.odontogram_tooth_surfaces;
CREATE POLICY "odontogram_surfaces_insert" ON public.odontogram_tooth_surfaces
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "odontogram_surfaces_update" ON public.odontogram_tooth_surfaces;
CREATE POLICY "odontogram_surfaces_update" ON public.odontogram_tooth_surfaces
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "odontogram_surfaces_delete" ON public.odontogram_tooth_surfaces;
CREATE POLICY "odontogram_surfaces_delete" ON public.odontogram_tooth_surfaces
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_surface_tooth ON public.odontogram_tooth_surfaces(odontogram_tooth_id);

-- ============================================================
-- 4. TABELA DE ANOTAÇÕES LIVRES NO ODONTOGRAMA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.odontogram_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odontogram_id   UUID NOT NULL REFERENCES public.odontograms(id) ON DELETE CASCADE,
  annotation_type TEXT NOT NULL DEFAULT 'note' CHECK (annotation_type IN (
    'note', 'alert', 'treatment_note', 'prognosis', 'referral', 'contraindication'
  )),
  content         TEXT NOT NULL,
  tooth_number    INTEGER, -- NULL = nota geral, ou NUMBER = nota específica do dente
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.odontogram_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_annotations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "odontogram_annotations_select" ON public.odontogram_annotations;
CREATE POLICY "odontogram_annotations_select" ON public.odontogram_annotations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "odontogram_annotations_insert" ON public.odontogram_annotations;
CREATE POLICY "odontogram_annotations_insert" ON public.odontogram_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "odontogram_annotations_delete" ON public.odontogram_annotations;
CREATE POLICY "odontogram_annotations_delete" ON public.odontogram_annotations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_annotations_odontogram ON public.odontogram_annotations(odontogram_id);

-- ============================================================
-- 5. RPC: Evolução de um dente ao longo do tempo (histórico)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.get_tooth_evolution(UUID, UUID, INTEGER) TO authenticated;

-- ============================================================
-- 6. RPC: Edição inline de odontograma (update in-place)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.update_odontogram_inline(UUID, TEXT, JSONB) TO authenticated;

-- ============================================================
-- 7. RPC: Comparação entre dois odontogramas (diff)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.compare_odontograms(UUID, UUID) TO authenticated;

-- ============================================================
-- 8. RPC expandida: get_odontogram_teeth com novos campos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_odontogram_teeth(
  p_odontogram_id UUID
)
RETURNS TABLE (
  tooth_number INTEGER,
  condition TEXT,
  surfaces TEXT,
  notes TEXT,
  procedure_date DATE,
  mobility_grade INTEGER,
  priority TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.tooth_number,
    t.condition,
    t.surfaces,
    t.notes,
    t.procedure_date,
    t.mobility_grade,
    t.priority
  FROM public.odontogram_teeth t
  WHERE t.odontogram_id = p_odontogram_id
  ORDER BY t.tooth_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_odontogram_teeth(UUID) TO authenticated;

-- ============================================================
-- 9. RPC: Estatísticas gerais do odontograma
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.get_odontogram_stats(UUID, UUID) TO authenticated;

-- ============================================================
-- FIM DA MIGRAÇÃO v2
-- ============================================================
