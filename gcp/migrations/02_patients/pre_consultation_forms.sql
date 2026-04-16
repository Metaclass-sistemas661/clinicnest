-- Table: pre_consultation_forms
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.pre_consultation_forms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  service_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB DEFAULT '[]' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.pre_consultation_forms ADD CONSTRAINT pre_consultation_forms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.pre_consultation_forms ADD CONSTRAINT pre_consultation_forms_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.procedures(id);
