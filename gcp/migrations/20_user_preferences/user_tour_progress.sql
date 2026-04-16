-- Table: user_tour_progress
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tour_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  step_index INTEGER DEFAULT 0 NOT NULL,
  tour_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.user_tour_progress ADD CONSTRAINT user_tour_progress_user_id_tour_id_key UNIQUE (user_id, tour_id);

ALTER TABLE public.user_tour_progress ADD CONSTRAINT user_tour_progress_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_user_tour_progress_tenant ON public.user_tour_progress USING btree (tenant_id, tour_key, updated_at DESC);

CREATE INDEX idx_user_tour_progress_user ON public.user_tour_progress USING btree (user_id);
