-- Table: sngpc_agendamentos
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_agendamentos (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  frequencia VARCHAR(20) DEFAULT 'semanal' NOT NULL,
  dia_semana INTEGER,
  dia_mes INTEGER,
  hora_execucao TIME DEFAULT '23:00:00',
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  ultima_transmissao_id UUID,
  notificar_sucesso BOOLEAN DEFAULT true,
  notificar_erro BOOLEAN DEFAULT true,
  emails_notificacao TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_agendamentos ADD CONSTRAINT sngpc_agendamentos_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.sngpc_agendamentos ADD CONSTRAINT sngpc_agendamentos_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.sngpc_agendamentos ADD CONSTRAINT sngpc_agendamentos_ultima_transmissao_id_fkey
  FOREIGN KEY (ultima_transmissao_id) REFERENCES public.sngpc_transmissoes(id);
