-- Table: adverse_events
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.adverse_events (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  reported_by UUID,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  root_cause TEXT,
  corrective_actions TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  acoes_corretivas TEXT,
  acoes_preventivas TEXT,
  circunstancias TEXT,
  conclusao TEXT,
  data_evento TIMESTAMPTZ NOT NULL,
  data_notificacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  data_notificacao_anvisa TIMESTAMPTZ,
  fatores_contribuintes TEXT[],
  licoes_aprendidas TEXT,
  local_evento TEXT,
  notificado_por UUID,
  prazo_acoes DATE,
  professional_id UUID,
  protocolo_anvisa TEXT,
  responsavel_investigacao UUID,
  setor TEXT,
  testemunhas TEXT,
  tipo_outro TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.adverse_events ADD CONSTRAINT adverse_events_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.adverse_events ADD CONSTRAINT adverse_events_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.adverse_events ADD CONSTRAINT adverse_events_notificado_por_fkey
  FOREIGN KEY (notificado_por) REFERENCES public.profiles(id);

ALTER TABLE public.adverse_events ADD CONSTRAINT adverse_events_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.adverse_events ADD CONSTRAINT adverse_events_responsavel_investigacao_fkey
  FOREIGN KEY (responsavel_investigacao) REFERENCES public.profiles(id);

CREATE INDEX idx_adverse_events_tenant ON public.adverse_events USING btree (tenant_id);
