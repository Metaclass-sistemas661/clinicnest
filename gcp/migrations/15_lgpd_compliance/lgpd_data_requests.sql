-- Table: lgpd_data_requests
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.lgpd_data_requests (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.lgpd_data_requests ADD CONSTRAINT lgpd_data_requests_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.lgpd_data_requests ADD CONSTRAINT lgpd_data_requests_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_lgpd_data_requests_tenant_status ON public.lgpd_data_requests USING btree (tenant_id, status, requested_at DESC);

CREATE INDEX idx_lgpd_requests_tenant ON public.lgpd_data_requests USING btree (tenant_id);
