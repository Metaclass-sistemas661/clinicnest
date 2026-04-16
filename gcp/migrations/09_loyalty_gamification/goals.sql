-- Table: goals
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ,
  custom_end DATE,
  custom_start DATE,
  header_priority INTEGER DEFAULT 0,
  parent_goal_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.goals ADD CONSTRAINT goals_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.goals ADD CONSTRAINT goals_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.goals ADD CONSTRAINT goals_parent_goal_id_fkey
  FOREIGN KEY (parent_goal_id) REFERENCES public.goals(id);

CREATE INDEX idx_goals_professional ON public.goals USING btree (professional_id);

CREATE INDEX idx_goals_tenant ON public.goals USING btree (tenant_id);
