-- Table: backup_verifications
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.backup_verifications (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  backup_log_id UUID NOT NULL,
  verification_type TEXT NOT NULL,
  status TEXT NOT NULL,
  checksum_match BOOLEAN,
  tables_verified INTEGER,
  records_verified BIGINT,
  errors_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  notes TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.backup_verifications ADD CONSTRAINT backup_verifications_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.backup_verifications ADD CONSTRAINT backup_verifications_backup_log_id_fkey
  FOREIGN KEY (backup_log_id) REFERENCES public.backup_logs(id);
