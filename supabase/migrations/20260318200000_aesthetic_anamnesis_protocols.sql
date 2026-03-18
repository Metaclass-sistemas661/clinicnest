-- Tabela de anamnese estética por paciente
CREATE TABLE IF NOT EXISTS aesthetic_anamnesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  fitzpatrick TEXT DEFAULT '',
  skin_type TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  isotretinoin BOOLEAN DEFAULT FALSE,
  pregnant BOOLEAN DEFAULT FALSE,
  previous_procedures TEXT DEFAULT '',
  expectations TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, patient_id)
);

-- Tabela de protocolos de tratamento estético
CREATE TABLE IF NOT EXISTS aesthetic_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  procedure TEXT NOT NULL DEFAULT '',
  total_sessions INT NOT NULL DEFAULT 4,
  completed_sessions INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 30,
  next_session_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE aesthetic_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE aesthetic_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_aesthetic_anamnesis"
  ON aesthetic_anamnesis FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_isolation_aesthetic_protocols"
  ON aesthetic_protocols FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aesthetic_anamnesis_patient ON aesthetic_anamnesis(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_aesthetic_protocols_patient ON aesthetic_protocols(tenant_id, patient_id);
