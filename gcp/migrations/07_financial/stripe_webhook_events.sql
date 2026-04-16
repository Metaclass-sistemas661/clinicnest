-- Table: stripe_webhook_events
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_stripe_events_type ON public.stripe_webhook_events USING btree (event_type);
