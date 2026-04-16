-- Table: hl7_field_mappings
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.hl7_field_mappings (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  connection_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  hl7_field TEXT NOT NULL,
  local_table TEXT NOT NULL,
  local_column TEXT NOT NULL,
  transform TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.hl7_field_mappings ADD CONSTRAINT hl7_field_mappings_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.hl7_connections(id);

ALTER TABLE public.hl7_field_mappings ADD CONSTRAINT hl7_field_mappings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
