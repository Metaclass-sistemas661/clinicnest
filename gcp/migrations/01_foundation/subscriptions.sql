-- Table: subscriptions
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  status TEXT DEFAULT 'trialing' NOT NULL,
  plan TEXT,
  trial_start TIMESTAMPTZ DEFAULT now() NOT NULL,
  trial_end TIMESTAMPTZ DEFAULT (now() + '7 days'::interval) NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  team_limit INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_subscriptions_asaas_customer_id ON public.subscriptions USING btree (asaas_customer_id);

CREATE INDEX idx_subscriptions_asaas_subscription_id ON public.subscriptions USING btree (asaas_subscription_id);

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id);

CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions USING btree (tenant_id);
