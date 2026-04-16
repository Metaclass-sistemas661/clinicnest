-- Table: ripd_reports
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ripd_reports (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  version VARCHAR(20) NOT NULL,
  title VARCHAR(200) DEFAULT 'Relatório de Impacto à Proteção de Dados Pessoais' NOT NULL,
  identificacao_agentes JSONB DEFAULT '{}' NOT NULL,
  necessidade_proporcionalidade JSONB DEFAULT '{}' NOT NULL,
  identificacao_riscos JSONB DEFAULT '{}' NOT NULL,
  medidas_salvaguardas JSONB DEFAULT '{}' NOT NULL,
  dados_pessoais_tratados JSONB DEFAULT '[]',
  bases_legais JSONB DEFAULT '[]',
  finalidades JSONB DEFAULT '[]',
  riscos_identificados JSONB DEFAULT '[]',
  matriz_riscos JSONB DEFAULT '{}',
  medidas_tecnicas JSONB DEFAULT '[]',
  medidas_administrativas JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  next_review_at DATE,
  review_notes TEXT,
  pdf_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.ripd_reports ADD CONSTRAINT ripd_reports_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
