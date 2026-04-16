-- Table: aesthetic_protocols
-- Domain: 06_aesthetic
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.aesthetic_protocols (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  name TEXT NOT NULL,
  procedure TEXT DEFAULT '' NOT NULL,
  total_sessions INTEGER DEFAULT 4 NOT NULL,
  completed_sessions INTEGER DEFAULT 0 NOT NULL,
  interval_days INTEGER DEFAULT 30 NOT NULL,
  next_session_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.aesthetic_protocols ADD CONSTRAINT aesthetic_protocols_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.aesthetic_protocols ADD CONSTRAINT aesthetic_protocols_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_aesthetic_protocols_patient ON public.aesthetic_protocols USING btree (tenant_id, patient_id);
