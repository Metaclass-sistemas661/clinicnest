-- Table: patient_profiles
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID,
  patient_id UUID,
  tenant_id UUID NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  access_code TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_profiles ADD CONSTRAINT patient_profiles_user_id_key UNIQUE (user_id);

ALTER TABLE public.patient_profiles ADD CONSTRAINT patient_profiles_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_profiles ADD CONSTRAINT patient_profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_patient_profiles_patient ON public.patient_profiles USING btree (patient_id);

CREATE INDEX idx_patient_profiles_tenant ON public.patient_profiles USING btree (tenant_id);
