-- Table: sngpc_credenciais
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_credenciais (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  cnpj VARCHAR(18) NOT NULL,
  razao_social VARCHAR(200),
  cpf_responsavel VARCHAR(14) NOT NULL,
  nome_responsavel VARCHAR(200) NOT NULL,
  crf_responsavel VARCHAR(20),
  email_notificacao VARCHAR(200),
  ativo BOOLEAN DEFAULT true,
  ultima_autenticacao TIMESTAMPTZ,
  token_expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_credenciais ADD CONSTRAINT sngpc_credenciais_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.sngpc_credenciais ADD CONSTRAINT sngpc_credenciais_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
