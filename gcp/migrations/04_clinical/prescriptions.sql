-- Table: prescriptions
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  appointment_id UUID,
  medications JSONB DEFAULT '[]' NOT NULL,
  notes TEXT,
  is_controlled BOOLEAN DEFAULT false,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  content_hash TEXT,
  digital_hash TEXT,
  server_timestamp TIMESTAMPTZ,
  signed_by_crm TEXT,
  signed_by_name TEXT,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions USING btree (patient_id);

CREATE INDEX idx_prescriptions_tenant_id ON public.prescriptions USING btree (tenant_id);
