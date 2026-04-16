-- Table: permission_overrides
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.permission_overrides (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID,
  resource TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false NOT NULL,
  can_create BOOLEAN DEFAULT false NOT NULL,
  can_edit BOOLEAN DEFAULT false NOT NULL,
  can_delete BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.permission_overrides ADD CONSTRAINT permission_overrides_tenant_id_user_id_resource_key UNIQUE (tenant_id, user_id, resource);

ALTER TABLE public.permission_overrides ADD CONSTRAINT permission_overrides_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
