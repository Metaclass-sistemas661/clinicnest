-- Table: audit_logs
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  actor_role TEXT,
  actor_user_id UUID,
  entity_id TEXT,
  entity_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs USING btree (tenant_id);

CREATE INDEX idx_audit_logs_tenant_action_created_at ON public.audit_logs USING btree (tenant_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_tenant_created_at ON public.audit_logs USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_audit_logs_tenant_entity_created_at ON public.audit_logs USING btree (tenant_id, entity_type, created_at DESC);

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);
