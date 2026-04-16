-- Table: retention_deletion_attempts
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.retention_deletion_attempts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT,
  retention_expires_at DATE,
  attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  blocked BOOLEAN DEFAULT true NOT NULL,
  reason TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.retention_deletion_attempts ADD CONSTRAINT retention_deletion_attempts_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.retention_deletion_attempts ADD CONSTRAINT retention_deletion_attempts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);
