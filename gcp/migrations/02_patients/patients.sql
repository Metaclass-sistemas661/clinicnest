-- Table: patients
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  blood_type TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  marketing_opt_out BOOLEAN DEFAULT false,
  photo_url TEXT,
  access_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  date_of_birth DATE,
  marital_status TEXT,
  street TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  insurance_plan_id UUID,
  insurance_card_number TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.patients ADD CONSTRAINT clients_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_clients_cpf ON public.patients USING btree (cpf);

CREATE INDEX idx_clients_email ON public.patients USING btree (email);

CREATE INDEX idx_clients_name ON public.patients USING btree (tenant_id, name);

CREATE INDEX idx_clients_tenant_id ON public.patients USING btree (tenant_id);
