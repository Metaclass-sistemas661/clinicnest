-- Table: sngpc_movimentacoes
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_movimentacoes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  estoque_id UUID,
  movement_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  prescription_id UUID,
  patient_id UUID,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_estoque_id_fkey
  FOREIGN KEY (estoque_id) REFERENCES public.sngpc_estoque(id);

ALTER TABLE public.sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);
