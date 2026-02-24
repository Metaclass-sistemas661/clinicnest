-- ============================================================
-- Clinical Evolutions (SOAP) v1
-- Evolução clínica diária no formato SOAP — padrão ouro em
-- sistemas como Tasy, MV e PEP hospitalar.
-- Diferente do prontuário (registro de consulta), a evolução
-- é o acompanhamento contínuo do paciente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clinical_evolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,

  evolution_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  evolution_type  TEXT NOT NULL DEFAULT 'medica'
    CHECK (evolution_type IN ('medica','fisioterapia','fonoaudiologia','nutricao','psicologia','enfermagem','outro')),

  -- SOAP fields
  subjective      TEXT,
  objective        TEXT,
  assessment       TEXT,
  plan             TEXT,

  -- Clinical data
  cid_code        TEXT,
  vital_signs     JSONB DEFAULT '{}',

  -- Digital signature
  digital_hash    TEXT,
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_crm   TEXT,

  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_tenant
  ON public.clinical_evolutions(tenant_id, evolution_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_client
  ON public.clinical_evolutions(client_id, evolution_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_professional
  ON public.clinical_evolutions(professional_id, evolution_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_appointment
  ON public.clinical_evolutions(appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.clinical_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_evolutions FORCE ROW LEVEL SECURITY;

CREATE POLICY clinical_evolutions_select ON public.clinical_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY clinical_evolutions_insert ON public.clinical_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY clinical_evolutions_update ON public.clinical_evolutions
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY clinical_evolutions_delete ON public.clinical_evolutions
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
    AND professional_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_clinical_evolutions_updated_at ON public.clinical_evolutions;
CREATE TRIGGER trg_clinical_evolutions_updated_at
  BEFORE UPDATE ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
