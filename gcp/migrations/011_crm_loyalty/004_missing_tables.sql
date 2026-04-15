-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (011_crm_loyalty)
-- 6 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260328400000_consent_signing_tokens_v1.sql
CREATE TABLE IF NOT EXISTS public.consent_signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  template_ids UUID[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT token_not_empty CHECK (token <> ''),
  CONSTRAINT template_ids_not_empty CHECK (array_length(template_ids, 1) > 0)
);

ALTER TABLE public.consent_signing_tokens ENABLE ROW LEVEL SECURITY;

-- Source: 20260316400000_health_credits.sql
CREATE TABLE IF NOT EXISTS public.health_credits_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_redeemed integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, patient_id)
);

ALTER TABLE public.health_credits_balance ENABLE ROW LEVEL SECURITY;

-- Source: 20260325100000_health_credits_engine.sql
CREATE TABLE IF NOT EXISTS public.health_credits_redemption_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  credits_per_real numeric NOT NULL DEFAULT 10,
  min_redeem integer NOT NULL DEFAULT 50,
  max_discount_percent numeric NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_credits_redemption_config ENABLE ROW LEVEL SECURITY;

-- Source: 20260316400000_health_credits.sql
CREATE TABLE IF NOT EXISTS public.health_credits_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'appointment_completed', 'referral', 'birthday', 'streak', 'review', 'vaccine', 'checkup'
  )),
  points integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_credits_rules ENABLE ROW LEVEL SECURITY;

-- Source: 20260316400000_health_credits.sql
CREATE TABLE IF NOT EXISTS public.health_credits_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjustment')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  reference_type text, -- 'appointment', 'campaign', 'manual', 'birthday'
  reference_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_credits_transactions ENABLE ROW LEVEL SECURITY;

-- Source: 20260327500000_tier_change_notification_v1.sql
CREATE TABLE IF NOT EXISTS public.professional_tier_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
    current_tier_index INTEGER NOT NULL DEFAULT 0,
    current_tier_value DECIMAL(5,2) NOT NULL DEFAULT 0,
    monthly_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, professional_id, rule_id)
);

ALTER TABLE public.professional_tier_tracking ENABLE ROW LEVEL SECURITY;

