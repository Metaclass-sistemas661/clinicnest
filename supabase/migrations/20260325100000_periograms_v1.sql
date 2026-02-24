-- Migration: Periograma (Periodontal Chart)
-- Fase 25D - Registro da saúde periodontal

-- Tabela principal de periogramas
CREATE TABLE IF NOT EXISTS periograms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  
  -- Índices calculados (armazenados para histórico)
  plaque_index DECIMAL(5,2), -- Índice de placa (%)
  bleeding_index DECIMAL(5,2), -- Índice de sangramento (%)
  avg_probing_depth DECIMAL(4,2), -- Média de profundidade de sondagem (mm)
  sites_over_4mm INTEGER DEFAULT 0, -- Sítios com profundidade > 4mm
  sites_over_6mm INTEGER DEFAULT 0, -- Sítios com profundidade > 6mm
  total_sites INTEGER DEFAULT 0, -- Total de sítios avaliados
  
  -- Diagnóstico periodontal
  periodontal_diagnosis TEXT, -- Gengivite, Periodontite leve/moderada/severa
  risk_classification TEXT CHECK (risk_classification IN ('baixo', 'moderado', 'alto')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Tabela de medições por sítio (6 sítios por dente)
-- Sítios: V (Vestibular), DV (Disto-Vestibular), MV (Mesio-Vestibular), 
--         L (Lingual/Palatino), DL (Disto-Lingual), ML (Mesio-Lingual)
CREATE TABLE IF NOT EXISTS periogram_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periogram_id UUID NOT NULL REFERENCES periograms(id) ON DELETE CASCADE,
  
  tooth_number INTEGER NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
  site TEXT NOT NULL CHECK (site IN ('V', 'DV', 'MV', 'L', 'DL', 'ML')),
  
  -- Medições clínicas
  probing_depth INTEGER CHECK (probing_depth BETWEEN 0 AND 15), -- Profundidade de sondagem (mm)
  recession INTEGER CHECK (recession BETWEEN -5 AND 15), -- Recessão gengival (mm, negativo = hiperplasia)
  clinical_attachment_level INTEGER, -- Nível de inserção clínica (calculado: probing_depth + recession)
  
  -- Indicadores booleanos
  bleeding BOOLEAN DEFAULT FALSE, -- Sangramento à sondagem
  suppuration BOOLEAN DEFAULT FALSE, -- Supuração
  plaque BOOLEAN DEFAULT FALSE, -- Presença de placa
  
  -- Mobilidade (registrada uma vez por dente, mas armazenada no sítio V)
  mobility INTEGER CHECK (mobility BETWEEN 0 AND 3), -- Grau de mobilidade (0-3)
  
  -- Furca (para molares, registrada no sítio V)
  furcation INTEGER CHECK (furcation BETWEEN 0 AND 3), -- Grau de lesão de furca (0-3)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(periogram_id, tooth_number, site)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_periograms_tenant ON periograms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_periograms_client ON periograms(client_id);
CREATE INDEX IF NOT EXISTS idx_periograms_date ON periograms(exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_periogram ON periogram_measurements(periogram_id);
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_tooth ON periogram_measurements(tooth_number);

-- RLS
ALTER TABLE periograms ENABLE ROW LEVEL SECURITY;
ALTER TABLE periogram_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periograms_tenant_isolation" ON periograms
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "periogram_measurements_access" ON periogram_measurements
  FOR ALL USING (
    periogram_id IN (
      SELECT id FROM periograms WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Trigger para updated_at
CREATE TRIGGER set_periograms_updated_at
  BEFORE UPDATE ON periograms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular índices do periograma
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

-- Função para obter periogramas de um paciente
CREATE OR REPLACE FUNCTION get_client_periograms(
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
  FROM periograms p
  LEFT JOIN profiles pr ON p.professional_id = pr.id
  WHERE p.tenant_id = p_tenant_id
    AND p.client_id = p_client_id
  ORDER BY p.exam_date DESC;
END;
$$;

-- Função para obter medições de um periograma
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

-- Função para salvar periograma com medições
CREATE OR REPLACE FUNCTION save_periogram_with_measurements(
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
AS $$
DECLARE
  v_periogram_id UUID;
  v_measurement JSONB;
BEGIN
  -- Criar periograma
  INSERT INTO periograms (
    tenant_id, client_id, professional_id, appointment_id,
    exam_date, notes, periodontal_diagnosis, risk_classification, created_by
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id,
    p_exam_date, p_notes, p_periodontal_diagnosis, p_risk_classification, p_professional_id
  )
  RETURNING id INTO v_periogram_id;

  -- Inserir medições
  FOR v_measurement IN SELECT * FROM jsonb_array_elements(p_measurements)
  LOOP
    INSERT INTO periogram_measurements (
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
  PERFORM calculate_periogram_indices(v_periogram_id);

  RETURN v_periogram_id;
END;
$$;

COMMENT ON TABLE periograms IS 'Exames de periograma (saúde periodontal)';
COMMENT ON TABLE periogram_measurements IS 'Medições do periograma - 6 sítios por dente';
COMMENT ON COLUMN periogram_measurements.site IS 'Sítio: V (Vestibular), DV (Disto-Vestibular), MV (Mesio-Vestibular), L (Lingual), DL (Disto-Lingual), ML (Mesio-Lingual)';
COMMENT ON COLUMN periogram_measurements.probing_depth IS 'Profundidade de sondagem em mm (0-15)';
COMMENT ON COLUMN periogram_measurements.recession IS 'Recessão gengival em mm (negativo = hiperplasia)';
