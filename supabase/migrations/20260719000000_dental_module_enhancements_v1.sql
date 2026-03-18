-- ============================================================
-- MIGRAÇÃO: Módulo Odontológico — Melhorias v1
-- Arquivo: 20260719000000_dental_module_enhancements_v1.sql
-- Descrição:
--   S3: CHECK constraints adicionais
--   D1: Tabela odontogram_tooth_history (audit trail por dente)
--   D2: Coluna attachment_urls em odontogram_teeth
--   D4: FK treatment_plan_items → odontogram_tooth
--   D5: Tabela dental_prescriptions
--   D6: View materializada dental_stats_summary
-- ============================================================

-- ============================================================
-- S3: Reforçar CHECK constraints no periogram_measurements
-- (tooth_number entre 11-48 ou 51-85 decíduos)
-- ============================================================

ALTER TABLE public.periogram_measurements DROP CONSTRAINT IF EXISTS periogram_measurements_tooth_number_check;
ALTER TABLE public.periogram_measurements ADD CONSTRAINT periogram_measurements_tooth_number_check
  CHECK (
    (tooth_number BETWEEN 11 AND 18) OR
    (tooth_number BETWEEN 21 AND 28) OR
    (tooth_number BETWEEN 31 AND 38) OR
    (tooth_number BETWEEN 41 AND 48) OR
    (tooth_number BETWEEN 51 AND 55) OR
    (tooth_number BETWEEN 61 AND 65) OR
    (tooth_number BETWEEN 71 AND 75) OR
    (tooth_number BETWEEN 81 AND 85)
  );

-- ============================================================
-- D1: Tabela odontogram_tooth_history — Audit trail por dente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.odontogram_tooth_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odontogram_id   UUID NOT NULL REFERENCES public.odontograms(id) ON DELETE CASCADE,
  tooth_number    INTEGER NOT NULL,
  
  -- O que mudou
  previous_condition TEXT,
  new_condition      TEXT NOT NULL,
  previous_surfaces  TEXT,
  new_surfaces       TEXT,
  previous_notes     TEXT,
  new_notes          TEXT,
  
  -- Quem e quando
  changed_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason   TEXT,
  
  -- Metadados
  ip_address      TEXT,
  user_agent      TEXT
);

COMMENT ON TABLE public.odontogram_tooth_history IS 'Audit trail de alterações por dente — rastreabilidade CFO';

CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_odontogram 
  ON public.odontogram_tooth_history(odontogram_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_tooth 
  ON public.odontogram_tooth_history(odontogram_id, tooth_number);
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_changed_at 
  ON public.odontogram_tooth_history(changed_at DESC);

ALTER TABLE public.odontogram_tooth_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_tooth_history FORCE ROW LEVEL SECURITY;

CREATE POLICY "odontogram_tooth_history_select" ON public.odontogram_tooth_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "odontogram_tooth_history_insert" ON public.odontogram_tooth_history
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

GRANT SELECT, INSERT ON public.odontogram_tooth_history TO authenticated;

-- ============================================================
-- D2: Coluna attachment_urls em odontogram_teeth
-- ============================================================

ALTER TABLE public.odontogram_teeth 
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.odontogram_teeth.attachment_urls IS 'URLs de radiografias e fotos vinculadas ao dente';

-- ============================================================
-- D4: FK treatment_plan_items → odontogram_teeth
-- ============================================================

ALTER TABLE public.treatment_plan_items 
  ADD COLUMN IF NOT EXISTS odontogram_tooth_id UUID REFERENCES public.odontogram_teeth(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth_id
  ON public.treatment_plan_items(odontogram_tooth_id);

-- ============================================================
-- D5: Tabela dental_prescriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dental_prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  periogram_id    UUID REFERENCES public.periograms(id) ON DELETE SET NULL,
  odontogram_id   UUID REFERENCES public.odontograms(id) ON DELETE SET NULL,
  
  -- Prescrição
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis       TEXT,
  medications     JSONB NOT NULL DEFAULT '[]',  -- [{name, dosage, frequency, duration, instructions}]
  instructions    TEXT,
  
  -- Assinatura
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_cro   TEXT,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dental_prescriptions IS 'Prescrições odontológicas vinculadas a periograma/odontograma';

CREATE INDEX IF NOT EXISTS idx_dental_prescriptions_tenant ON public.dental_prescriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_prescriptions_patient ON public.dental_prescriptions(patient_id);

ALTER TABLE public.dental_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_prescriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "dental_prescriptions_tenant_isolation" ON public.dental_prescriptions
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.dental_prescriptions TO authenticated;

-- ============================================================
-- D6: View materializada para estatísticas dentais
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dental_stats AS
SELECT 
  o.tenant_id,
  o.client_id AS patient_id,
  COUNT(DISTINCT o.id) AS total_odontograms,
  COUNT(DISTINCT ot.id) AS total_tooth_records,
  COUNT(DISTINCT CASE WHEN ot.condition = 'caries' THEN ot.id END) AS total_caries,
  COUNT(DISTINCT CASE WHEN ot.condition = 'missing' THEN ot.id END) AS total_missing,
  COUNT(DISTINCT CASE WHEN ot.condition = 'restored' THEN ot.id END) AS total_restored,
  COUNT(DISTINCT CASE WHEN ot.priority = 'urgent' THEN ot.id END) AS total_urgent,
  MAX(o.exam_date) AS last_exam_date,
  (SELECT COUNT(*) FROM public.treatment_plans tp 
   WHERE tp.client_id = o.client_id AND tp.tenant_id = o.tenant_id AND tp.status = 'em_andamento') AS active_plans,
  (SELECT COUNT(*) FROM public.periograms p 
   WHERE p.client_id = o.client_id AND p.tenant_id = o.tenant_id) AS total_periograms
FROM public.odontograms o
LEFT JOIN public.odontogram_teeth ot ON ot.odontogram_id = o.id
GROUP BY o.tenant_id, o.client_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dental_stats_pk 
  ON public.mv_dental_stats(tenant_id, patient_id);

-- Function to refresh the materialized view
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

GRANT EXECUTE ON FUNCTION public.refresh_dental_stats() TO service_role;

-- ============================================================
-- Trigger: Auto-log tooth changes to history
-- ============================================================

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

DROP TRIGGER IF EXISTS trg_odontogram_tooth_change ON public.odontogram_teeth;
CREATE TRIGGER trg_odontogram_tooth_change
  AFTER UPDATE ON public.odontogram_teeth
  FOR EACH ROW
  EXECUTE FUNCTION public.log_odontogram_tooth_change();

-- ============================================================
-- RPC: get_tooth_history — buscar histórico por dente
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.get_tooth_history(UUID, INTEGER) TO authenticated;

-- ============================================================
-- RPC: get_dental_dashboard — KPIs odontológicos
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.get_dental_dashboard(UUID, DATE, DATE) TO authenticated;
