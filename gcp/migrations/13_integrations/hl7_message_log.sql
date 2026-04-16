-- Table: hl7_message_log
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.hl7_message_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  connection_id UUID,
  direction TEXT NOT NULL,
  message_type TEXT,
  raw_message TEXT,
  status TEXT DEFAULT 'received',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.hl7_message_log ADD CONSTRAINT hl7_message_log_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.hl7_message_log ADD CONSTRAINT hl7_message_log_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.hl7_connections(id);

CREATE INDEX idx_hl7_message_log_tenant ON public.hl7_message_log USING btree (tenant_id);
