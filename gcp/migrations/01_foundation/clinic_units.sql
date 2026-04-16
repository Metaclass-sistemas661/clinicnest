-- Table: clinic_units
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.clinic_units (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state BPCHAR,
  address_zip TEXT,
  cnes_code TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.clinic_units ADD CONSTRAINT clinic_units_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
