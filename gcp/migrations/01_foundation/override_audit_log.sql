-- Table: override_audit_log
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.override_audit_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  override_type TEXT NOT NULL,
  override_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.override_audit_log ADD CONSTRAINT override_audit_log_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.override_audit_log ADD CONSTRAINT override_audit_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id);
