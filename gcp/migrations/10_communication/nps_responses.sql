-- Table: nps_responses
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.nps_responses (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  score INTEGER NOT NULL,
  comment TEXT,
  source TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.nps_responses ADD CONSTRAINT nps_responses_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.nps_responses ADD CONSTRAINT nps_responses_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_nps_responses_tenant_created ON public.nps_responses USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_nps_tenant ON public.nps_responses USING btree (tenant_id);
