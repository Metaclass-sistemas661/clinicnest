-- Table: sngpc_sequencial
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_sequencial (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  tipo_receituario TEXT NOT NULL,
  ano INTEGER NOT NULL,
  ultimo_numero INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_sequencial ADD CONSTRAINT sngpc_sequencial_tenant_id_tipo_receituario_ano_key UNIQUE (tenant_id, tipo_receituario, ano);

ALTER TABLE public.sngpc_sequencial ADD CONSTRAINT sngpc_sequencial_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
