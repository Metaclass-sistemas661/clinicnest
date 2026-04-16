-- Table: push_subscriptions
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);
