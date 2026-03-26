-- SNGPC: Tabela de rastreamento de prescrições controladas
-- e RNDS: Tabela de bundles FHIR recebidos (bidirecional)

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SNGPC — Rastreamento de Prescrições Controladas           ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.sngpc_tracked_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Classificação ANVISA
  anvisa_lista TEXT NOT NULL CHECK (anvisa_lista IN (
    'A1','A2','B1','B2','C1','C2','C3','C4','C5','antimicrobiano'
  )),
  recipe_type TEXT NOT NULL, -- 'amarela', 'azul', 'branca_especial'
  
  -- Medicamento
  medication_name TEXT NOT NULL,
  medication_dosage TEXT,
  medication_quantity TEXT,
  medication_duration_days INT,
  
  -- Dispensação
  dispensed_at TIMESTAMPTZ,
  dispensed_by TEXT,
  dispensed_pharmacy TEXT,
  dispensation_status TEXT NOT NULL DEFAULT 'pendente' 
    CHECK (dispensation_status IN ('pendente','dispensado','parcial','cancelado','expirado')),
  
  -- Rastreamento SNGPC
  sngpc_notified BOOLEAN DEFAULT FALSE,
  sngpc_notification_date TIMESTAMPTZ,
  sngpc_protocol TEXT, -- Protocolo de notificação retornado

  -- Validade
  prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_sngpc_tenant ON public.sngpc_tracked_prescriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_patient ON public.sngpc_tracked_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_lista ON public.sngpc_tracked_prescriptions(anvisa_lista);
CREATE INDEX IF NOT EXISTS idx_sngpc_status ON public.sngpc_tracked_prescriptions(dispensation_status);
CREATE INDEX IF NOT EXISTS idx_sngpc_expires ON public.sngpc_tracked_prescriptions(expires_at);

-- RLS
ALTER TABLE public.sngpc_tracked_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sngpc_tenant_isolation" ON public.sngpc_tracked_prescriptions
  FOR ALL USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trg_sngpc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sngpc_updated_at ON public.sngpc_tracked_prescriptions;
CREATE TRIGGER sngpc_updated_at
  BEFORE UPDATE ON public.sngpc_tracked_prescriptions
  FOR EACH ROW EXECUTE FUNCTION trg_sngpc_updated_at();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RNDS Bidirecional — Bundles FHIR Recebidos                ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.incoming_rnds_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Dados do bundle FHIR
  bundle_type TEXT NOT NULL DEFAULT 'document',  -- document, message, transaction
  fhir_bundle JSONB NOT NULL,
  bundle_id TEXT, -- Bundle.id do FHIR original
  
  -- Origem
  source_cnes TEXT,           -- CNES do estabelecimento de origem
  source_name TEXT,           -- Nome do estabelecimento
  source_uf TEXT,
  
  -- Paciente (deduplicação)
  patient_cpf TEXT,
  patient_name TEXT,
  matched_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  
  -- Recursos extraídos (cache)
  resource_types TEXT[], -- ex: ['Condition','Observation','MedicationRequest']
  resource_count INT DEFAULT 0,
  
  -- Status de review
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','reviewed','accepted','rejected','merged')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Metadados
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_tenant ON public.incoming_rnds_bundles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_status ON public.incoming_rnds_bundles(review_status);
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_patient ON public.incoming_rnds_bundles(matched_patient_id);
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_cpf ON public.incoming_rnds_bundles(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_received ON public.incoming_rnds_bundles(received_at DESC);

-- RLS
ALTER TABLE public.incoming_rnds_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rnds_incoming_tenant_isolation" ON public.incoming_rnds_bundles
  FOR ALL USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

-- View para estatísticas RNDS bidirecional
CREATE OR REPLACE VIEW public.rnds_incoming_statistics AS
SELECT
  tenant_id,
  COUNT(*) AS total_received,
  COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE review_status = 'accepted') AS accepted_count,
  COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE review_status = 'merged') AS merged_count,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) AS error_count,
  MAX(received_at) AS last_received_at
FROM public.incoming_rnds_bundles
GROUP BY tenant_id;
