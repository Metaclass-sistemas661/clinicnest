-- Table: consent_templates
-- Domain: 11_consent_documents
-- Updated: 2026-04-17 (enterprise hardening)

CREATE TABLE IF NOT EXISTS public.consent_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  body_html TEXT DEFAULT '',
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  template_type TEXT DEFAULT 'html',
  pdf_storage_path TEXT,
  pdf_original_filename TEXT,
  pdf_file_size INTEGER,
  PRIMARY KEY (id),
  CONSTRAINT uq_consent_templates_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant_id
  ON public.consent_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant_active_sort
  ON public.consent_templates(tenant_id, is_active, sort_order);

ALTER TABLE public.consent_templates ADD CONSTRAINT consent_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
