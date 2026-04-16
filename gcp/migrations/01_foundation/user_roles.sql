-- Table: user_roles
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role APP_ROLE DEFAULT 'staff' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_tenant_id_key UNIQUE (user_id, tenant_id);

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_user_roles_tenant_id ON public.user_roles USING btree (tenant_id);

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
