-- Table: admin_audit_logs
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  actor_user_id UUID NOT NULL,
  entity_id TEXT,
  entity_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_admin_audit_logs_actor ON public.admin_audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_admin_audit_logs_tenant ON public.admin_audit_logs USING btree (tenant_id);

CREATE INDEX idx_admin_audit_logs_tenant_created_at ON public.admin_audit_logs USING btree (tenant_id, created_at DESC);
