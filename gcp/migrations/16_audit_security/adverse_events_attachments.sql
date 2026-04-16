-- Table: adverse_events_attachments
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.adverse_events_attachments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  adverse_event_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.adverse_events_attachments ADD CONSTRAINT adverse_events_attachments_adverse_event_id_fkey
  FOREIGN KEY (adverse_event_id) REFERENCES public.adverse_events(id);
