-- Table: automations
-- Domain: 17_automation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.automations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  action_type TEXT NOT NULL,
  action_config JSONB,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  channel TEXT NOT NULL,
  message_template TEXT NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.automations ADD CONSTRAINT automations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_automations_tenant ON public.automations USING btree (tenant_id);

CREATE INDEX idx_automations_tenant_active ON public.automations USING btree (tenant_id, is_active);
