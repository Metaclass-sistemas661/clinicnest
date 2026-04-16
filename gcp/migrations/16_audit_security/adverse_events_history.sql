-- Table: adverse_events_history
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.adverse_events_history (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  adverse_event_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  old_status ADVERSE_EVENT_STATUS,
  new_status ADVERSE_EVENT_STATUS,
  comentario TEXT,
  dados_alterados JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.adverse_events_history ADD CONSTRAINT adverse_events_history_adverse_event_id_fkey
  FOREIGN KEY (adverse_event_id) REFERENCES public.adverse_events(id);
