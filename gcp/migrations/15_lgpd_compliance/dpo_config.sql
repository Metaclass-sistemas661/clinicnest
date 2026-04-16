-- Table: dpo_config
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.dpo_config (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf TEXT,
  formacao TEXT,
  certificacoes TEXT[],
  publicado BOOLEAN DEFAULT false,
  url_publicacao TEXT,
  data_nomeacao DATE,
  email_publico TEXT,
  telefone_publico TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.dpo_config ADD CONSTRAINT dpo_config_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.dpo_config ADD CONSTRAINT dpo_config_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
