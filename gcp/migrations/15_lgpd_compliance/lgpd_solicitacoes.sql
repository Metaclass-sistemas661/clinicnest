-- Table: lgpd_solicitacoes
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.lgpd_solicitacoes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  titular_nome TEXT NOT NULL,
  titular_email TEXT NOT NULL,
  titular_cpf TEXT,
  titular_telefone TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  dados_solicitados TEXT[],
  status TEXT DEFAULT 'recebida' NOT NULL,
  data_solicitacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  prazo_resposta TIMESTAMPTZ,
  data_resposta TIMESTAMPTZ,
  resposta TEXT,
  motivo_negativa TEXT,
  arquivos_resposta TEXT[],
  atendido_por UUID,
  historico JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.lgpd_solicitacoes ADD CONSTRAINT lgpd_solicitacoes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
