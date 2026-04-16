-- Table: patient_deletion_requests
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_deletion_requests (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  scheduled_for TIMESTAMPTZ DEFAULT (now() + '30 days'::interval) NOT NULL,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tenant_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_deletion_requests ADD CONSTRAINT patient_deletion_requests_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_deletion_requests ADD CONSTRAINT patient_deletion_requests_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
