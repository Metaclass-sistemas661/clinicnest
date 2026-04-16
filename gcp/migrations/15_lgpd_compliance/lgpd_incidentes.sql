-- Table: lgpd_incidentes
-- Domain: 15_lgpd_compliance
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.lgpd_incidentes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL,
  dados_afetados TEXT[],
  categorias_dados TEXT[],
  quantidade_titulares_afetados INTEGER,
  titulares_identificados BOOLEAN DEFAULT false,
  data_ocorrencia TIMESTAMPTZ,
  data_deteccao TIMESTAMPTZ DEFAULT now() NOT NULL,
  data_contencao TIMESTAMPTZ,
  data_resolucao TIMESTAMPTZ,
  status TEXT DEFAULT 'detectado' NOT NULL,
  requer_notificacao_anpd BOOLEAN DEFAULT false,
  notificacao_anpd_enviada BOOLEAN DEFAULT false,
  data_notificacao_anpd TIMESTAMPTZ,
  protocolo_anpd TEXT,
  prazo_notificacao TIMESTAMPTZ,
  requer_notificacao_titulares BOOLEAN DEFAULT false,
  notificacao_titulares_enviada BOOLEAN DEFAULT false,
  data_notificacao_titulares TIMESTAMPTZ,
  medidas_contencao TEXT[],
  medidas_remediacao TEXT[],
  medidas_preventivas TEXT[],
  responsavel_investigacao UUID,
  responsavel_comunicacao UUID,
  evidencias JSONB DEFAULT '[]',
  timeline_acoes JSONB DEFAULT '[]',
  post_mortem TEXT,
  licoes_aprendidas TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.lgpd_incidentes ADD CONSTRAINT lgpd_incidentes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
