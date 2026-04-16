-- Table: sngpc_transmissoes
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_transmissoes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  xml_content TEXT,
  response TEXT,
  transmitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_transmissoes ADD CONSTRAINT sngpc_transmissoes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
