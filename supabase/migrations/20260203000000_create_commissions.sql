-- Migration: Sistema de Comissões
-- Cria tabelas para configuração e pagamento de comissões de profissionais

-- 1. Criar enum para tipo de comissão (se não existir)
DO $$ BEGIN
    CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar enum para status de pagamento (se não existir)
DO $$ BEGIN
    CREATE TYPE public.commission_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Criar tabela de configuração de comissões por profissional (se não existir)
CREATE TABLE IF NOT EXISTS public.professional_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    type public.commission_type NOT NULL,
    value DECIMAL(10,2) NOT NULL CHECK (value >= 0),
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garantir apenas uma comissão ativa por profissional por tenant
    UNIQUE(user_id, tenant_id)
);

-- 4. Criar tabela de pagamentos de comissões (se não existir)
CREATE TABLE IF NOT EXISTS public.commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    commission_config_id UUID REFERENCES public.professional_commissions(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    service_price DECIMAL(10,2) NOT NULL CHECK (service_price >= 0),
    commission_type public.commission_type NOT NULL,
    commission_value DECIMAL(10,2) NOT NULL CHECK (commission_value >= 0),
    status public.commission_status NOT NULL DEFAULT 'pending',
    payment_date DATE,
    notes TEXT,
    paid_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Criar índices para performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_professional_commissions_user_tenant ON public.professional_commissions(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_professional_commissions_tenant ON public.professional_commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_tenant ON public.commission_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_professional ON public.commission_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON public.commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_appointment ON public.commission_payments(appointment_id);

-- 6. Aplicar trigger updated_at (se não existirem)
DROP TRIGGER IF EXISTS update_professional_commissions_updated_at ON public.professional_commissions;
CREATE TRIGGER update_professional_commissions_updated_at 
    BEFORE UPDATE ON public.professional_commissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_payments_updated_at ON public.commission_payments;
CREATE TRIGGER update_commission_payments_updated_at 
    BEFORE UPDATE ON public.commission_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Habilitar RLS
ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies para professional_commissions
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Profissionais podem ver sua própria comissão" ON public.professional_commissions;
DROP POLICY IF EXISTS "Apenas admins podem criar/atualizar comissões" ON public.professional_commissions;
DROP POLICY IF EXISTS "Apenas admins podem deletar comissões" ON public.professional_commissions;

-- SELECT: Profissionais podem ver sua própria comissão, admins veem todas do tenant
CREATE POLICY "Profissionais podem ver sua própria comissão"
    ON public.professional_commissions FOR SELECT
    USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = professional_commissions.tenant_id
            AND ur.role = 'admin'
        )
    );

-- INSERT/UPDATE: Apenas admins do mesmo tenant
CREATE POLICY "Apenas admins podem criar/atualizar comissões"
    ON public.professional_commissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = professional_commissions.tenant_id
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = professional_commissions.tenant_id
            AND ur.role = 'admin'
        )
    );

-- DELETE: Apenas admins
CREATE POLICY "Apenas admins podem deletar comissões"
    ON public.professional_commissions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = professional_commissions.tenant_id
            AND ur.role = 'admin'
        )
    );

-- 9. RLS Policies para commission_payments
-- Remover TODAS as políticas antigas se existirem
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Profissionais podem ver suas próprias comissões" ON public.commission_payments;
    DROP POLICY IF EXISTS "Sistema e admins podem criar pagamentos de comissão" ON public.commission_payments;
    DROP POLICY IF EXISTS "Apenas admins podem atualizar pagamentos" ON public.commission_payments;
    DROP POLICY IF EXISTS "Apenas admins podem deletar pagamentos" ON public.commission_payments;
EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros se políticas não existirem
    NULL;
END $$;

-- SELECT: Profissionais veem suas próprias comissões, admins veem todas do tenant
CREATE POLICY "Profissionais podem ver suas próprias comissões"
    ON public.commission_payments FOR SELECT
    USING (
        auth.uid() = professional_id
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- INSERT: Sistema pode criar automaticamente quando agendamento é completado (via trigger SECURITY DEFINER)
-- Admins também podem criar manualmente
CREATE POLICY "Sistema e admins podem criar pagamentos de comissão"
    ON public.commission_payments FOR INSERT
    WITH CHECK (
        -- Permitir inserção via trigger (SECURITY DEFINER) ou por admin
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- UPDATE: Apenas admins podem atualizar (marcar como pago, etc)
CREATE POLICY "Apenas admins podem atualizar pagamentos"
    ON public.commission_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- DELETE: Apenas admins
CREATE POLICY "Apenas admins podem deletar pagamentos"
    ON public.commission_payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- 10. Função para calcular comissão automaticamente quando agendamento é completado
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_commission_config RECORD;
    v_commission_amount DECIMAL(10,2);
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Buscar configuração de comissão do profissional
        SELECT * INTO v_commission_config
        FROM public.professional_commissions
        WHERE user_id = NEW.professional_id
        AND tenant_id = NEW.tenant_id
        LIMIT 1;

        -- Se existe configuração, calcular e criar registro de comissão
        IF v_commission_config IS NOT NULL THEN
            -- Calcular valor da comissão
            IF v_commission_config.type = 'percentage' THEN
                v_commission_amount := NEW.price * (v_commission_config.value / 100);
            ELSE
                v_commission_amount := v_commission_config.value;
            END IF;

            -- Criar registro de comissão pendente
            INSERT INTO public.commission_payments (
                tenant_id,
                professional_id,
                appointment_id,
                commission_config_id,
                amount,
                service_price,
                commission_type,
                commission_value,
                status
            ) VALUES (
                NEW.tenant_id,
                NEW.professional_id,
                NEW.id,
                v_commission_config.id,
                v_commission_amount,
                NEW.price,
                v_commission_config.type,
                v_commission_config.value,
                'pending'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 11. Criar trigger para calcular comissão automaticamente (se não existir)
DROP TRIGGER IF EXISTS trigger_calculate_commission_on_completed ON public.appointments;
CREATE TRIGGER trigger_calculate_commission_on_completed
    AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
    EXECUTE FUNCTION public.calculate_commission_on_appointment_completed();
