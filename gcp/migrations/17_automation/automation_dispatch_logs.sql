-- Table: automation_dispatch_logs
-- Domain: 17_automation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.automation_dispatch_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  automation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  status TEXT DEFAULT 'sent',
  target TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  channel TEXT NOT NULL,
  details JSONB DEFAULT '{}' NOT NULL,
  dispatch_period TEXT DEFAULT 'once' NOT NULL,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.automation_dispatch_logs ADD CONSTRAINT automation_dispatch_logs_automation_id_fkey
  FOREIGN KEY (automation_id) REFERENCES public.automations(id);

ALTER TABLE public.automation_dispatch_logs ADD CONSTRAINT automation_dispatch_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_automation_dispatch_tenant_created ON public.automation_dispatch_logs USING btree (tenant_id, created_at DESC);

CREATE UNIQUE INDEX uq_automation_dispatch_v2 ON public.automation_dispatch_logs USING btree (automation_id, entity_type, entity_id, dispatch_period);
