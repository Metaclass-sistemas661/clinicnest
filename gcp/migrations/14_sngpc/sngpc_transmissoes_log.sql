-- Table: sngpc_transmissoes_log
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_transmissoes_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  transmissao_id UUID NOT NULL,
  acao VARCHAR(50) NOT NULL,
  status_anterior SNGPC_TRANSMISSAO_STATUS,
  status_novo SNGPC_TRANSMISSAO_STATUS,
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  erro_mensagem TEXT,
  executado_por UUID,
  executado_em TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_transmissoes_log ADD CONSTRAINT sngpc_transmissoes_log_transmissao_id_fkey
  FOREIGN KEY (transmissao_id) REFERENCES public.sngpc_transmissoes(id);
