-- Table: record_field_templates
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.record_field_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  specialty_id UUID,
  name TEXT NOT NULL,
  fields JSONB DEFAULT '[]' NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.record_field_templates ADD CONSTRAINT record_field_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.record_field_templates ADD CONSTRAINT record_field_templates_specialty_id_fkey
  FOREIGN KEY (specialty_id) REFERENCES public.specialties(id);
