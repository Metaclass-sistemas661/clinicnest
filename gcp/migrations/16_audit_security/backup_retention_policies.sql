-- Table: backup_retention_policies
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.backup_retention_policies (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  backup_type TEXT NOT NULL,
  retention_days INTEGER DEFAULT 365 NOT NULL,
  min_copies INTEGER DEFAULT 3,
  schedule_cron TEXT,
  enabled BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_on_success BOOLEAN DEFAULT false,
  notification_emails TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.backup_retention_policies ADD CONSTRAINT backup_retention_policies_tenant_id_name_key UNIQUE (tenant_id, name);

ALTER TABLE public.backup_retention_policies ADD CONSTRAINT backup_retention_policies_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
