-- Table: tenant_sequences
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tenant_sequences (
  tenant_id UUID NOT NULL,
  attendance_seq BIGINT DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (tenant_id)
);

ALTER TABLE public.tenant_sequences ADD CONSTRAINT tenant_sequences_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
