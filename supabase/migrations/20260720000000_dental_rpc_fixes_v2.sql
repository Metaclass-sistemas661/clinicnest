-- ============================================================
-- MIGRAÇÃO: Correções de RPCs Odontológicas + D3 + S4 + TUSS
-- Arquivo: 20260720000000_dental_rpc_fixes_v2.sql
-- Descrição:
--   C1: Fix create_odontogram_with_teeth — salvar mobility_grade, priority, dentition_type
--   C2: Fix get_client_odontograms — retornar dentition_type
--   C3: Expandir CHECK constraint de treatment_plan_items.tooth_number para decíduos (51-85)
--   D3: Coluna cal materializada em periogram_measurements
--   S4: Rate limiting function para RPCs
--   TUSS: Tabela de preços TUSS odontológica
-- ============================================================

-- ============================================================
-- C1: Fix create_odontogram_with_teeth
-- Adicionar mobility_grade, priority e dentition_type
-- ============================================================

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

-- ============================================================
-- C2: Fix get_client_odontograms — retornar dentition_type
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
GRANT EXECUTE ON FUNCTION public.get_client_odontograms(UUID, UUID) TO authenticated;

-- ============================================================
-- C3: Expandir CHECK constraint de treatment_plan_items.tooth_number
-- Aceitar decíduos (51-85) além de permanentes (11-48)
-- ============================================================

ALTER TABLE public.treatment_plan_items DROP CONSTRAINT IF EXISTS treatment_plan_items_tooth_number_check;
ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_tooth_number_check
  CHECK (
    tooth_number IS NULL
    OR (tooth_number BETWEEN 11 AND 18)
    OR (tooth_number BETWEEN 21 AND 28)
    OR (tooth_number BETWEEN 31 AND 38)
    OR (tooth_number BETWEEN 41 AND 48)
    OR (tooth_number BETWEEN 51 AND 55)
    OR (tooth_number BETWEEN 61 AND 65)
    OR (tooth_number BETWEEN 71 AND 75)
    OR (tooth_number BETWEEN 81 AND 85)
  );

-- ============================================================
-- D3: Coluna CAL materializada em periogram_measurements
-- NIC = probing_depth + recession (derivado, mas materializado)
-- ============================================================

ALTER TABLE public.periogram_measurements
  ADD COLUMN IF NOT EXISTS clinical_attachment_level NUMERIC(4,1);

COMMENT ON COLUMN public.periogram_measurements.clinical_attachment_level 
  IS 'Nível de Inserção Clínica (NIC/CAL) = probing_depth + recession';

-- Trigger para auto-calcular CAL ao INSERT/UPDATE
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

DROP TRIGGER IF EXISTS trg_calc_periogram_cal ON public.periogram_measurements;
CREATE TRIGGER trg_calc_periogram_cal
  BEFORE INSERT OR UPDATE OF probing_depth, recession ON public.periogram_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_periogram_cal();

-- Backfill existing rows
UPDATE public.periogram_measurements
SET clinical_attachment_level = probing_depth + recession
WHERE probing_depth IS NOT NULL AND recession IS NOT NULL
  AND clinical_attachment_level IS NULL;

-- Index for fast CAL queries
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_cal
  ON public.periogram_measurements(clinical_attachment_level)
  WHERE clinical_attachment_level IS NOT NULL;

-- ============================================================
-- S4: Rate limiting function (server-side)
-- Limita chamadas RPC por user/minuto
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id       UUID NOT NULL,
  rpc_name      TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  call_count    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, rpc_name, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_cleanup
  ON public.rpc_rate_limits(window_start);

ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpc_rate_limits FORCE ROW LEVEL SECURITY;

-- Only service_role writes; no direct user access
CREATE POLICY "rpc_rate_limits_service_only" ON public.rpc_rate_limits
  FOR ALL TO service_role USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpc_rate_limits TO service_role;

-- Helper: check and increment rate limit (returns true if allowed)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_rpc_name TEXT,
  p_max_per_minute INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', NOW());
  v_count INTEGER;
BEGIN
  -- Cleanup old windows (older than 5 minutes)
  DELETE FROM public.rpc_rate_limits 
  WHERE window_start < v_window - INTERVAL '5 minutes';
  
  -- Upsert current window
  INSERT INTO public.rpc_rate_limits (user_id, rpc_name, window_start, call_count)
  VALUES (p_user_id, p_rpc_name, v_window, 1)
  ON CONFLICT (user_id, rpc_name, window_start)
  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1
  RETURNING call_count INTO v_count;
  
  RETURN v_count <= p_max_per_minute;
END;
$$;

-- ============================================================
-- TUSS: Tabela de preços odontológicos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tuss_odonto_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tuss_code     TEXT NOT NULL,
  description   TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, tuss_code)
);

COMMENT ON TABLE public.tuss_odonto_prices IS 'Tabela TUSS odontológica com preços por tenant';

CREATE INDEX IF NOT EXISTS idx_tuss_odonto_prices_tenant ON public.tuss_odonto_prices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tuss_odonto_prices_code ON public.tuss_odonto_prices(tenant_id, tuss_code);

ALTER TABLE public.tuss_odonto_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuss_odonto_prices FORCE ROW LEVEL SECURITY;

CREATE POLICY "tuss_prices_tenant_isolation" ON public.tuss_odonto_prices
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tuss_odonto_prices TO authenticated;

-- Seed: Procedimentos TUSS odontológicos mais comuns (template para tenant)
-- Nota: estes preços são base; cada tenant pode personalizar
CREATE OR REPLACE FUNCTION public.seed_tuss_odonto_defaults(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tuss_odonto_prices (tenant_id, tuss_code, description, default_price, category)
  VALUES
    (p_tenant_id, '81000065', 'Consulta odontológica inicial', 150.00, 'Consulta'),
    (p_tenant_id, '81000073', 'Consulta odontológica de retorno', 100.00, 'Consulta'),
    (p_tenant_id, '81000170', 'Urgência odontológica', 200.00, 'Urgência'),
    (p_tenant_id, '82000034', 'Restauração direta em resina composta - 1 face', 180.00, 'Restauração'),
    (p_tenant_id, '82000042', 'Restauração direta em resina composta - 2 faces', 250.00, 'Restauração'),
    (p_tenant_id, '82000050', 'Restauração direta em resina composta - 3 faces', 320.00, 'Restauração'),
    (p_tenant_id, '82000069', 'Restauração direta em amálgama - 1 face', 120.00, 'Restauração'),
    (p_tenant_id, '83000030', 'Tratamento endodôntico unirradicular', 600.00, 'Endodontia'),
    (p_tenant_id, '83000048', 'Tratamento endodôntico birradicular', 800.00, 'Endodontia'),
    (p_tenant_id, '83000056', 'Tratamento endodôntico multirradicular', 1000.00, 'Endodontia'),
    (p_tenant_id, '84000036', 'Raspagem subgengival por hemiarcada', 250.00, 'Periodontia'),
    (p_tenant_id, '84000044', 'Raspagem supragengival', 200.00, 'Periodontia'),
    (p_tenant_id, '85000032', 'Exodontia simples', 200.00, 'Cirurgia'),
    (p_tenant_id, '85000040', 'Exodontia de dente incluso', 500.00, 'Cirurgia'),
    (p_tenant_id, '85000059', 'Exodontia de dente semi-incluso', 400.00, 'Cirurgia'),
    (p_tenant_id, '86000039', 'Coroa metalocerâmica', 1200.00, 'Prótese'),
    (p_tenant_id, '86000047', 'Coroa em cerâmica pura', 1800.00, 'Prótese'),
    (p_tenant_id, '86000055', 'Prótese parcial removível', 1500.00, 'Prótese'),
    (p_tenant_id, '86000063', 'Prótese total', 2000.00, 'Prótese'),
    (p_tenant_id, '87000035', 'Aplicação de selante por dente', 80.00, 'Prevenção'),
    (p_tenant_id, '87000043', 'Aplicação tópica de flúor', 60.00, 'Prevenção'),
    (p_tenant_id, '87000051', 'Profilaxia', 150.00, 'Prevenção'),
    (p_tenant_id, '88000031', 'Radiografia periapical', 40.00, 'Radiologia'),
    (p_tenant_id, '88000049', 'Radiografia panorâmica', 120.00, 'Radiologia'),
    (p_tenant_id, '88000057', 'Radiografia interproximal (bite-wing)', 40.00, 'Radiologia'),
    (p_tenant_id, '89000038', 'Clareamento dental de consultório', 800.00, 'Estética'),
    (p_tenant_id, '89000046', 'Faceta direta em resina', 400.00, 'Estética'),
    (p_tenant_id, '89000054', 'Faceta indireta em porcelana', 1500.00, 'Estética')
  ON CONFLICT (tenant_id, tuss_code) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_tuss_odonto_defaults(UUID) TO authenticated;

-- RPC: get_tuss_prices
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

GRANT EXECUTE ON FUNCTION public.get_tuss_odonto_prices(UUID) TO authenticated;
