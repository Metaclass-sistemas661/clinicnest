-- Table: hl7_connections
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.hl7_connections (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 2575 NOT NULL,
  direction TEXT NOT NULL,
  message_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  auth_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.hl7_connections ADD CONSTRAINT hl7_connections_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_hl7_connections_tenant ON public.hl7_connections USING btree (tenant_id);
