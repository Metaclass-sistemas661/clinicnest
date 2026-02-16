-- P9: Performance indexes for audit_logs

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_created_at
  ON public.audit_logs (tenant_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity_created_at
  ON public.audit_logs (tenant_id, entity_type, created_at DESC);
