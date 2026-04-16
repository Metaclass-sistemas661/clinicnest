-- Table: goal_templates
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.goal_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  default_target NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.goal_templates ADD CONSTRAINT goal_templates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_goal_templates_tenant ON public.goal_templates USING btree (tenant_id);
