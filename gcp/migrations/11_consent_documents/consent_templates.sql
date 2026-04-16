-- Table: consent_templates
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.consent_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.consent_templates ADD CONSTRAINT consent_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
