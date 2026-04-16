-- Table: lgpd_retention_policies
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.lgpd_retention_policies (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  data_category TEXT DEFAULT 'geral' NOT NULL,
  retention_years INTEGER DEFAULT 20 NOT NULL,
  legal_basis TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.lgpd_retention_policies ADD CONSTRAINT lgpd_retention_policies_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.lgpd_retention_policies ADD CONSTRAINT lgpd_retention_policies_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
