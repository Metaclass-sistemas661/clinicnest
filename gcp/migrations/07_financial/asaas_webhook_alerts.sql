-- Table: asaas_webhook_alerts
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.asaas_webhook_alerts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  event_id UUID,
  event_type TEXT,
  reason TEXT NOT NULL,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  checkout_session_id TEXT,
  payload JSONB,
  PRIMARY KEY (id)
);

CREATE INDEX asaas_webhook_alerts_created_at_idx ON public.asaas_webhook_alerts USING btree (created_at);

CREATE INDEX asaas_webhook_alerts_event_type_idx ON public.asaas_webhook_alerts USING btree (event_type);
