-- Table: treatment_plans
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'proposed',
  total_cost NUMERIC DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_by_client BOOLEAN DEFAULT false,
  client_id UUID NOT NULL,
  client_signature TEXT,
  description TEXT,
  discount_percent NUMERIC DEFAULT 0,
  discount_value NUMERIC DEFAULT 0,
  final_value NUMERIC DEFAULT 0 NOT NULL,
  installments INTEGER DEFAULT 1,
  odontogram_id UUID,
  signature_ip TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_odontogram_id_fkey
  FOREIGN KEY (odontogram_id) REFERENCES public.odontograms(id);

CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans USING btree (patient_id);
