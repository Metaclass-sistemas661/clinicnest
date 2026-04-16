-- Table: goal_achievements
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.goal_achievements (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  goal_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB,
  PRIMARY KEY (id)
);

ALTER TABLE public.goal_achievements ADD CONSTRAINT goal_achievements_goal_id_fkey
  FOREIGN KEY (goal_id) REFERENCES public.goals(id);

ALTER TABLE public.goal_achievements ADD CONSTRAINT goal_achievements_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_goal_achievements_goal ON public.goal_achievements USING btree (goal_id);

CREATE INDEX idx_goal_achievements_tenant ON public.goal_achievements USING btree (tenant_id);
