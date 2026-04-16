-- Table: feedback_analysis
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.feedback_analysis (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  feedback_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  sentiment TEXT NOT NULL,
  score NUMERIC NOT NULL,
  aspects JSONB DEFAULT '[]',
  summary TEXT,
  action_required BOOLEAN DEFAULT false,
  suggested_action TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.feedback_analysis ADD CONSTRAINT feedback_analysis_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
