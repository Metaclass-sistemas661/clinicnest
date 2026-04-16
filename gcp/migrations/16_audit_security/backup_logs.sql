-- Table: backup_logs
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  backup_id TEXT NOT NULL,
  backup_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' NOT NULL,
  size_bytes BIGINT,
  tables_count INTEGER,
  records_count BIGINT,
  duration_seconds INTEGER,
  checksum_algorithm TEXT DEFAULT 'SHA-256',
  checksum_value TEXT,
  verification_checksum TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  storage_location TEXT,
  storage_provider TEXT,
  retention_days INTEGER DEFAULT 365,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  backup_name VARCHAR(200) NOT NULL,
  compressed_size_bytes BIGINT,
  deleted_at TIMESTAMPTZ,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  is_deleted BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  restore_test_success BOOLEAN,
  storage_path TEXT,
  storage_region VARCHAR(50),
  verification_hash TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.backup_logs ADD CONSTRAINT backup_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
