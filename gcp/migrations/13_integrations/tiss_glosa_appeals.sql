-- Table: tiss_glosa_appeals
-- Domain: uncategorized
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tiss_glosa_appeals (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  tiss_guide_id UUID NOT NULL,
  appeal_number TEXT NOT NULL,
  justification TEXT NOT NULL,
  requested_value NUMERIC DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  response_text TEXT,
  resolved_value NUMERIC,
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.tiss_glosa_appeals ADD CONSTRAINT tiss_glosa_appeals_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.tiss_glosa_appeals ADD CONSTRAINT tiss_glosa_appeals_tiss_guide_id_fkey
  FOREIGN KEY (tiss_guide_id) REFERENCES public.tiss_guides(id);
