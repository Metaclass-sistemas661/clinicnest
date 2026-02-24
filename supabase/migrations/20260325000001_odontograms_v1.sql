-- ============================================================
-- MIGRAÇÃO: Odontograma — Tabelas Dedicadas
-- Arquivo: 20260325000000_odontograms_v1.sql
-- Fase: 25A — Correção e Infraestrutura do Odontograma
-- Descrição: Cria tabelas dedicadas para odontograma em vez de
--   usar coluna JSONB em medical_records (que não existia).
-- ============================================================

-- Garantir que o tipo professional_type existe
DO $$ BEGIN
    CREATE TYPE public.professional_type AS ENUM (
      'admin',
      'medico',
      'dentista',
      'enfermeiro',
      'tec_enfermagem',
      'fisioterapeuta',
      'nutricionista',
      'psicologo',
      'fonoaudiologo',
      'secretaria',
      'faturista',
      'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Garantir que a coluna professional_type existe em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_type public.professional_type NOT NULL DEFAULT 'secretaria';

-- Garantir que a função is_clinical_professional existe
CREATE OR REPLACE FUNCTION public.is_clinical_professional(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND professional_type IN (
        'medico'::public.professional_type,
        'dentista'::public.professional_type,
        'enfermeiro'::public.professional_type,
        'fisioterapeuta'::public.professional_type,
        'nutricionista'::public.professional_type,
        'psicologo'::public.professional_type,
        'fonoaudiologo'::public.professional_type
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_clinical_professional(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_professional(UUID) TO service_role;

-- ─── 25A.1: Tabela principal de odontogramas ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.odontograms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Metadados
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  
  -- Assinatura digital (opcional)
  digital_hash    TEXT,
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_crm   TEXT,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.odontograms IS 'Registros de odontograma por paciente — Fase 25A';
COMMENT ON COLUMN public.odontograms.exam_date IS 'Data do exame odontológico';
COMMENT ON COLUMN public.odontograms.digital_hash IS 'SHA-256 do conteúdo para assinatura digital';

-- ─── 25A.2: Tabela de registros por dente (normalizada) ──────────────────────

CREATE TABLE IF NOT EXISTS public.odontogram_teeth (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odontogram_id   UUID NOT NULL REFERENCES public.odontograms(id) ON DELETE CASCADE,
  
  -- Identificação do dente (FDI: 11-18, 21-28, 31-38, 41-48)
  tooth_number    INTEGER NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
  
  -- Condição do dente
  condition       TEXT NOT NULL DEFAULT 'healthy'
                    CHECK (condition IN (
                      'healthy',      -- Saudável
                      'caries',       -- Cárie
                      'restored',     -- Restaurado
                      'missing',      -- Ausente
                      'crown',        -- Coroa
                      'implant',      -- Implante
                      'endodontic',   -- Endodontia
                      'extraction',   -- Indicado extração
                      'prosthesis',   -- Prótese
                      'fracture'      -- Fratura
                    )),
  
  -- Faces/superfícies afetadas (V=Vestibular, L=Lingual, M=Mesial, D=Distal, O=Oclusal, I=Incisal)
  surfaces        TEXT,
  
  -- Observações específicas do dente
  notes           TEXT,
  
  -- Data do procedimento (se aplicável)
  procedure_date  DATE,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: um dente por odontograma
  UNIQUE (odontogram_id, tooth_number)
);

COMMENT ON TABLE public.odontogram_teeth IS 'Registros individuais por dente — normalizado';
COMMENT ON COLUMN public.odontogram_teeth.tooth_number IS 'Número FDI do dente (11-48)';
COMMENT ON COLUMN public.odontogram_teeth.surfaces IS 'Faces afetadas: V, L, M, D, O, I';

-- ─── 25A.4: RLS por tenant + permissão só dentista ───────────────────────────

ALTER TABLE public.odontograms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontograms FORCE ROW LEVEL SECURITY;

ALTER TABLE public.odontogram_teeth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_teeth FORCE ROW LEVEL SECURITY;

-- Helper: verifica se é dentista
CREATE OR REPLACE FUNCTION public.is_dentist(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND professional_type = 'dentista'::public.professional_type
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_dentist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dentist(UUID) TO service_role;

-- Políticas para odontograms
-- SELECT: admin + clínicos podem ver
DROP POLICY IF EXISTS "odontograms_select" ON public.odontograms;
CREATE POLICY "odontograms_select" ON public.odontograms
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- INSERT: apenas dentistas
DROP POLICY IF EXISTS "odontograms_insert" ON public.odontograms;
CREATE POLICY "odontograms_insert" ON public.odontograms
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- UPDATE: apenas dentistas (mesmo tenant)
DROP POLICY IF EXISTS "odontograms_update" ON public.odontograms;
CREATE POLICY "odontograms_update" ON public.odontograms
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- DELETE: apenas admin
DROP POLICY IF EXISTS "odontograms_delete" ON public.odontograms;
CREATE POLICY "odontograms_delete" ON public.odontograms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Políticas para odontogram_teeth (herda do odontogram pai)
DROP POLICY IF EXISTS "odontogram_teeth_select" ON public.odontogram_teeth;
CREATE POLICY "odontogram_teeth_select" ON public.odontogram_teeth
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_clinical_professional(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "odontogram_teeth_insert" ON public.odontogram_teeth;
CREATE POLICY "odontogram_teeth_insert" ON public.odontogram_teeth
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "odontogram_teeth_update" ON public.odontogram_teeth;
CREATE POLICY "odontogram_teeth_update" ON public.odontogram_teeth
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "odontogram_teeth_delete" ON public.odontogram_teeth;
CREATE POLICY "odontogram_teeth_delete" ON public.odontogram_teeth
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );

-- ─── 25A.5: Índices para performance ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_odontograms_tenant_client 
  ON public.odontograms(tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_odontograms_client_date 
  ON public.odontograms(client_id, exam_date DESC);

CREATE INDEX IF NOT EXISTS idx_odontograms_professional 
  ON public.odontograms(professional_id);

CREATE INDEX IF NOT EXISTS idx_odontograms_appointment 
  ON public.odontograms(appointment_id);

CREATE INDEX IF NOT EXISTS idx_odontogram_teeth_odontogram 
  ON public.odontogram_teeth(odontogram_id);

CREATE INDEX IF NOT EXISTS idx_odontogram_teeth_tooth 
  ON public.odontogram_teeth(odontogram_id, tooth_number);

-- ─── Trigger para updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_odontogram_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_odontograms_updated_at ON public.odontograms;
CREATE TRIGGER trg_odontograms_updated_at
  BEFORE UPDATE ON public.odontograms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_odontogram_updated_at();

DROP TRIGGER IF EXISTS trg_odontogram_teeth_updated_at ON public.odontogram_teeth;
CREATE TRIGGER trg_odontogram_teeth_updated_at
  BEFORE UPDATE ON public.odontogram_teeth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_odontogram_updated_at();

-- ─── RPCs para operações comuns ──────────────────────────────────────────────

-- RPC: Criar odontograma com dentes em uma transação
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

  -- Cria o odontograma
  INSERT INTO public.odontograms (
    tenant_id, client_id, professional_id, appointment_id, exam_date, notes
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

-- RPC: Buscar odontogramas de um paciente com contagem de dentes
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
    AND o.client_id = p_client_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_odontograms(UUID, UUID) TO authenticated;

-- RPC: Buscar dentes de um odontograma
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

GRANT EXECUTE ON FUNCTION public.get_odontogram_teeth(UUID) TO authenticated;

-- RPC: Atualizar dentes de um odontograma (upsert)
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

GRANT EXECUTE ON FUNCTION public.upsert_odontogram_teeth(UUID, JSONB) TO authenticated;

-- ─── View para relatórios ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_odontogram_summary AS
SELECT 
  o.id as odontogram_id,
  o.tenant_id,
  o.client_id,
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
LEFT JOIN public.clients c ON c.id = o.client_id
LEFT JOIN public.profiles p ON p.id = o.professional_id
GROUP BY o.id, o.tenant_id, o.client_id, c.name, o.professional_id, p.full_name, o.exam_date, o.notes, o.created_at;

COMMENT ON VIEW public.v_odontogram_summary IS 'Resumo de odontogramas com contagem por condição';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
