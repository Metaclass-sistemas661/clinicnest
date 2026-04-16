-- Table: prescription_refill_requests
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.prescription_refill_requests (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  prescription_id UUID,
  medication_name TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.prescription_refill_requests ADD CONSTRAINT prescription_refill_requests_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.prescription_refill_requests ADD CONSTRAINT prescription_refill_requests_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);
