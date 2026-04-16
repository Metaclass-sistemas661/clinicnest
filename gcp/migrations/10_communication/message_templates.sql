-- Table: message_templates
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
