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

-- Seed: Procedimentos TUSS odontológicos completos (template para tenant)
-- Nota: estes preços são referência; cada tenant pode personalizar no painel admin
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
