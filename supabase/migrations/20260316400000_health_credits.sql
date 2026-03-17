-- ============================================================================
-- MIGRAÇÃO: Créditos de Saúde / Programa de Fidelidade
-- Tabelas: health_credits_balance, health_credits_transactions, health_credits_rules
-- ============================================================================

-- Saldo de créditos do paciente
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

-- Transações de créditos (earn/redeem)
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
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Regras de acúmulo configuráveis por tenant
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

-- RLS
ALTER TABLE public.health_credits_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_credits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_credits_rules ENABLE ROW LEVEL SECURITY;

-- Balance: profissionais leem/editam do tenant, pacientes leem o próprio
CREATE POLICY "professionals_manage_credits_balance"
  ON public.health_credits_balance
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "patients_view_own_balance"
  ON public.health_credits_balance
  FOR SELECT
  USING (
    patient_id IN (
      SELECT client_id FROM public.patient_profiles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Transactions: profissionais leem/inserem, pacientes leem as próprias
CREATE POLICY "professionals_manage_credits_transactions"
  ON public.health_credits_transactions
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "patients_view_own_transactions"
  ON public.health_credits_transactions
  FOR SELECT
  USING (
    patient_id IN (
      SELECT client_id FROM public.patient_profiles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Rules: profissionais gerenciam
CREATE POLICY "professionals_manage_credits_rules"
  ON public.health_credits_rules
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Indices
CREATE INDEX IF NOT EXISTS idx_health_credits_balance_tenant_patient
  ON public.health_credits_balance (tenant_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_health_credits_transactions_patient
  ON public.health_credits_transactions (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_credits_transactions_tenant
  ON public.health_credits_transactions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_credits_rules_tenant
  ON public.health_credits_rules (tenant_id, is_active);
