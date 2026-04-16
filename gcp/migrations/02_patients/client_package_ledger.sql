-- Table: client_package_ledger
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.client_package_ledger (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  package_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  action TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.client_package_ledger ADD CONSTRAINT client_package_ledger_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.patient_packages(id);

ALTER TABLE public.client_package_ledger ADD CONSTRAINT client_package_ledger_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.client_package_ledger ADD CONSTRAINT client_package_ledger_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_client_package_ledger_pkg ON public.client_package_ledger USING btree (package_id, created_at DESC);
