-- Table: sngpc_notificacoes_receita
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_notificacoes_receita (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  tipo_receituario TEXT NOT NULL,
  lista TEXT NOT NULL,
  medicamento_codigo TEXT NOT NULL,
  medicamento_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  posologia TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL,
  paciente_id UUID,
  paciente_nome TEXT NOT NULL,
  paciente_endereco TEXT NOT NULL,
  paciente_cidade TEXT NOT NULL,
  paciente_uf TEXT NOT NULL,
  paciente_cpf TEXT,
  prescriptor_id UUID,
  prescriptor_nome TEXT NOT NULL,
  prescriptor_crm TEXT NOT NULL,
  prescriptor_uf TEXT NOT NULL,
  data_emissao DATE DEFAULT CURRENT_DATE NOT NULL,
  data_validade DATE NOT NULL,
  status TEXT DEFAULT 'EMITIDA' NOT NULL,
  data_dispensacao DATE,
  movimentacao_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_tenant_id_numero_serie_key UNIQUE (tenant_id, numero, serie);

ALTER TABLE public.sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.patients(id);

ALTER TABLE public.sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_prescriptor_id_fkey
  FOREIGN KEY (prescriptor_id) REFERENCES public.profiles(id);

ALTER TABLE public.sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_movimentacao_id_fkey
  FOREIGN KEY (movimentacao_id) REFERENCES public.sngpc_movimentacoes(id);
