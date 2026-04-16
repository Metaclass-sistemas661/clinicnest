-- Table: client_packages
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.client_packages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER DEFAULT 0,
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'active',
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.client_packages ADD CONSTRAINT client_packages_tenant_id_fkey1
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.client_packages ADD CONSTRAINT client_packages_patient_id_fkey1
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE UNIQUE INDEX client_packages_pkey1 ON public.client_packages USING btree (id);
