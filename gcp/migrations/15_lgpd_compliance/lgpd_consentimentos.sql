-- Table: lgpd_consentimentos
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.lgpd_consentimentos (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  titular_id UUID,
  titular_email TEXT NOT NULL,
  titular_nome TEXT,
  finalidade TEXT NOT NULL,
  descricao TEXT,
  dados_coletados TEXT[],
  consentido BOOLEAN NOT NULL,
  data_consentimento TIMESTAMPTZ DEFAULT now() NOT NULL,
  data_revogacao TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  metodo TEXT,
  evidencia_url TEXT,
  validade_dias INTEGER,
  data_expiracao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.lgpd_consentimentos ADD CONSTRAINT lgpd_consentimentos_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
