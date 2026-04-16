-- Table: rnds_submissions
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.rnds_submissions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  fhir_bundle TEXT,
  status TEXT DEFAULT 'pending',
  response TEXT,
  rnds_id TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.rnds_submissions ADD CONSTRAINT rnds_submissions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_rnds_submissions_tenant ON public.rnds_submissions USING btree (tenant_id);
