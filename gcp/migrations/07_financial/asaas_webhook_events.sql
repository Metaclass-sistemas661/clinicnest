-- Table: asaas_webhook_events
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  event_key TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT DEFAULT 'received' NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.asaas_webhook_events ADD CONSTRAINT asaas_webhook_events_event_key_key UNIQUE (event_key);

CREATE INDEX asaas_webhook_events_received_at_idx ON public.asaas_webhook_events USING btree (received_at DESC);

CREATE INDEX asaas_webhook_events_status_idx ON public.asaas_webhook_events USING btree (status);

CREATE INDEX idx_asaas_events_type ON public.asaas_webhook_events USING btree (event_type);
