-- Migration: Infraestrutura Multi-Gateway para Split de Pagamento
-- Tabelas para configuração de gateways por tenant e contas de profissionais

-- 1. Enum para tipos de gateway
DO $$ BEGIN
    CREATE TYPE public.payment_gateway_provider AS ENUM ('asaas', 'pagseguro', 'stone', 'stripe');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela de configuração de gateway por tenant
CREATE TABLE IF NOT EXISTS public.tenant_payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider public.payment_gateway_provider NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    webhook_secret_encrypted TEXT,
    environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_split_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    split_fee_payer TEXT DEFAULT 'clinic' CHECK (split_fee_payer IN ('clinic', 'professional', 'split')),
    metadata JSONB DEFAULT '{}',
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_tenant 
ON public.tenant_payment_gateways(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_active 
ON public.tenant_payment_gateways(tenant_id, is_active) 
WHERE is_active = TRUE;

-- 4. Tabela de contas de pagamento dos profissionais
CREATE TABLE IF NOT EXISTS public.professional_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    gateway_id UUID NOT NULL REFERENCES public.tenant_payment_gateways(id) ON DELETE CASCADE,
    provider public.payment_gateway_provider NOT NULL,
    recipient_id TEXT,
    wallet_id TEXT,
    account_id TEXT,
    pix_key TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, professional_id, gateway_id)
);

-- 5. Índices para contas de profissionais
CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_professional 
ON public.professional_payment_accounts(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_tenant 
ON public.professional_payment_accounts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_gateway 
ON public.professional_payment_accounts(gateway_id);

-- 6. Tabela de logs de transações de split
CREATE TABLE IF NOT EXISTS public.split_payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    charge_id TEXT NOT NULL,
    provider public.payment_gateway_provider NOT NULL,
    professional_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    split_amount DECIMAL(12,2) NOT NULL,
    clinic_amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    error_message TEXT,
    webhook_received_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Índices para logs de split
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_tenant 
ON public.split_payment_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_split_payment_logs_appointment 
ON public.split_payment_logs(appointment_id);

CREATE INDEX IF NOT EXISTS idx_split_payment_logs_charge 
ON public.split_payment_logs(charge_id);

CREATE INDEX IF NOT EXISTS idx_split_payment_logs_professional 
ON public.split_payment_logs(professional_id);

CREATE INDEX IF NOT EXISTS idx_split_payment_logs_status 
ON public.split_payment_logs(status);

-- 8. RLS
ALTER TABLE public.tenant_payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_payment_logs ENABLE ROW LEVEL SECURITY;

-- Policies para tenant_payment_gateways
CREATE POLICY "Admins can manage tenant payment gateways"
ON public.tenant_payment_gateways FOR ALL
USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
);

-- Policies para professional_payment_accounts
CREATE POLICY "Admins can manage professional payment accounts"
ON public.professional_payment_accounts FOR ALL
USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Professionals can view their own payment accounts"
ON public.professional_payment_accounts FOR SELECT
USING (professional_id = auth.uid());

-- Policies para split_payment_logs
CREATE POLICY "Admins can view split payment logs"
ON public.split_payment_logs FOR SELECT
USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Professionals can view their own split logs"
ON public.split_payment_logs FOR SELECT
USING (professional_id = auth.uid());

-- 9. Função para obter gateway ativo do tenant
CREATE OR REPLACE FUNCTION public.get_active_payment_gateway(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    provider public.payment_gateway_provider,
    api_key_encrypted TEXT,
    webhook_secret_encrypted TEXT,
    environment TEXT,
    is_split_enabled BOOLEAN,
    split_fee_payer TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.provider,
        g.api_key_encrypted,
        g.webhook_secret_encrypted,
        g.environment,
        g.is_split_enabled,
        g.split_fee_payer
    FROM public.tenant_payment_gateways g
    WHERE g.tenant_id = p_tenant_id
    AND g.is_active = TRUE
    AND g.validation_status = 'valid'
    ORDER BY g.updated_at DESC
    LIMIT 1;
END;
$$;

-- 10. Função para obter conta de pagamento do profissional
CREATE OR REPLACE FUNCTION public.get_professional_payment_account(
    p_tenant_id UUID,
    p_professional_id UUID
)
RETURNS TABLE (
    id UUID,
    provider public.payment_gateway_provider,
    recipient_id TEXT,
    wallet_id TEXT,
    account_id TEXT,
    is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gateway_id UUID;
BEGIN
    -- Buscar gateway ativo do tenant
    SELECT g.id INTO v_gateway_id
    FROM public.tenant_payment_gateways g
    WHERE g.tenant_id = p_tenant_id
    AND g.is_active = TRUE
    AND g.validation_status = 'valid'
    LIMIT 1;

    IF v_gateway_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        pa.id,
        pa.provider,
        pa.recipient_id,
        pa.wallet_id,
        pa.account_id,
        pa.is_verified
    FROM public.professional_payment_accounts pa
    WHERE pa.tenant_id = p_tenant_id
    AND pa.professional_id = p_professional_id
    AND pa.gateway_id = v_gateway_id
    AND pa.is_verified = TRUE
    LIMIT 1;
END;
$$;

-- 11. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payment_gateways TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_payment_accounts TO authenticated;
GRANT SELECT, INSERT ON public.split_payment_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_payment_gateway(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professional_payment_account(UUID, UUID) TO authenticated;
