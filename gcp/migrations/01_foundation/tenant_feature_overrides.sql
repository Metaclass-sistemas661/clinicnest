-- Table: tenant_feature_overrides
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tenant_feature_overrides (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  reason TEXT,
  enabled_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT tenant_feature_overrides_tenant_id_feature_key_key UNIQUE (tenant_id, feature_key);

ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT tenant_feature_overrides_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT tenant_feature_overrides_enabled_by_fkey
  FOREIGN KEY (enabled_by) REFERENCES public.profiles(id);
