-- Table: goal_suggestions
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.goal_suggestions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  suggested_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT,
  target_value NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.goal_suggestions ADD CONSTRAINT goal_suggestions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_goal_suggestions_status ON public.goal_suggestions USING btree (tenant_id, status);

CREATE INDEX idx_goal_suggestions_tenant ON public.goal_suggestions USING btree (tenant_id);
