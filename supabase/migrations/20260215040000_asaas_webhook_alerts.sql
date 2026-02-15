CREATE TABLE IF NOT EXISTS public.asaas_webhook_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_id UUID,
    event_type TEXT,
    reason TEXT NOT NULL,
    asaas_subscription_id TEXT,
    asaas_payment_id TEXT,
    checkout_session_id TEXT,
    payload JSONB
);

CREATE INDEX IF NOT EXISTS asaas_webhook_alerts_created_at_idx
ON public.asaas_webhook_alerts(created_at);

CREATE INDEX IF NOT EXISTS asaas_webhook_alerts_event_type_idx
ON public.asaas_webhook_alerts(event_type);
