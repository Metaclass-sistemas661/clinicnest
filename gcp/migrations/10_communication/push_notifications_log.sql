-- Table: push_notifications_log
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.push_notifications_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID,
  user_id UUID,
  subscription_id UUID,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

ALTER TABLE public.push_notifications_log ADD CONSTRAINT push_notifications_log_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.push_notifications_log ADD CONSTRAINT push_notifications_log_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id);
