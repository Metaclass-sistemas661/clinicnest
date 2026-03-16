-- ═══════════════════════════════════════════════════════════════════════════════
-- FASE 5B — PROMs (Patient Reported Outcome Measures)
--
-- Tabela para coletar métricas de saúde reportadas pelo paciente entre consultas.
-- Gera alertas quando scores pioram significativamente.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.patient_proms (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  questionnaire  text NOT NULL DEFAULT 'general',   -- 'general', 'pain', 'phq9', 'gad7', 'eq5d'
  answers        jsonb NOT NULL DEFAULT '{}',        -- respostas estruturadas
  total_score    integer,                            -- score calculado
  max_score      integer,                            -- score máximo possível
  severity       text,                               -- 'minimal', 'mild', 'moderate', 'severe'
  notes          text,                               -- nota do paciente
  created_at     timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_severity CHECK (severity IS NULL OR severity IN ('minimal', 'mild', 'moderate', 'severe'))
);

-- RLS
ALTER TABLE public.patient_proms ENABLE ROW LEVEL SECURITY;

-- Profissionais da clínica leem PROMs
CREATE POLICY "Profissionais leem PROMs do tenant" ON public.patient_proms
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Pacientes inserem seus próprios PROMs
CREATE POLICY "Pacientes inserem PROMs" ON public.patient_proms
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
    AND tenant_id IN (
      SELECT pp.tenant_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- Pacientes leem seus próprios PROMs
CREATE POLICY "Pacientes leem seus PROMs" ON public.patient_proms
  FOR SELECT USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_proms_patient ON public.patient_proms(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proms_tenant ON public.patient_proms(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proms_severity ON public.patient_proms(tenant_id, severity) WHERE severity IN ('moderate', 'severe');

COMMENT ON TABLE public.patient_proms IS 'Patient Reported Outcome Measures - métricas de saúde reportadas pelo paciente entre consultas. Fase 5B.';
