-- Table: schedule_blocks
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.schedule_blocks ADD CONSTRAINT schedule_blocks_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.schedule_blocks ADD CONSTRAINT schedule_blocks_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_sb_prof_range ON public.schedule_blocks USING btree (professional_id, start_at, end_at);

CREATE INDEX idx_sb_tenant_range ON public.schedule_blocks USING btree (tenant_id, start_at, end_at);

CREATE INDEX idx_schedule_blocks_professional ON public.schedule_blocks USING btree (professional_id);
