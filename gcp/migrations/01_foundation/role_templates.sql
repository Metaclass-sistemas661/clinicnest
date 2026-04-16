-- Table: role_templates
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  professional_type PROFESSIONAL_TYPE NOT NULL,
  permissions JSONB DEFAULT '{}' NOT NULL,
  is_system BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.role_templates ADD CONSTRAINT role_templates_tenant_id_professional_type_key UNIQUE (tenant_id, professional_type);

ALTER TABLE public.role_templates ADD CONSTRAINT role_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
