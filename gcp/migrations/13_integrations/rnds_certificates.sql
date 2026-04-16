-- Table: rnds_certificates
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.rnds_certificates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  certificate_data TEXT NOT NULL,
  password_hash TEXT,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.rnds_certificates ADD CONSTRAINT rnds_certificates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
