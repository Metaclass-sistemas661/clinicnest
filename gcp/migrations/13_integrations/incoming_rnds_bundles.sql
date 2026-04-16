-- Table: incoming_rnds_bundles
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.incoming_rnds_bundles (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  bundle_type TEXT DEFAULT 'document' NOT NULL,
  fhir_bundle JSONB NOT NULL,
  bundle_id TEXT,
  source_cnes TEXT,
  source_name TEXT,
  source_uf TEXT,
  patient_cpf TEXT,
  patient_name TEXT,
  matched_patient_id UUID,
  resource_types TEXT[],
  resource_count INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'pending' NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_matched_patient_id_fkey
  FOREIGN KEY (matched_patient_id) REFERENCES public.patients(id);

ALTER TABLE public.incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
