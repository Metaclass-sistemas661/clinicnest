-- Migration: Sub-fase 31C — Captação e Indicações
-- Adiciona campo booked_by_id para rastrear quem agendou/indicou o paciente
-- Adiciona rule_type 'referral' para comissão por captação

-- 1. Adicionar campo booked_by_id na tabela appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS booked_by_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN public.appointments.booked_by_id IS 
'ID do funcionário que agendou ou indicou este atendimento. Usado para comissão por captação.';

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_appointments_booked_by 
ON public.appointments(booked_by_id) 
WHERE booked_by_id IS NOT NULL;

-- 4. Adicionar 'referral' ao enum commission_rule_type (se não existir)
DO $$ 
BEGIN
    -- Verificar se o valor já existe no enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'referral' 
        AND enumtypid = 'public.commission_rule_type'::regtype
    ) THEN
        ALTER TYPE public.commission_rule_type ADD VALUE 'referral';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. Criar função para calcular comissão de captação
CREATE OR REPLACE FUNCTION public.calculate_referral_commission(
    p_appointment_id UUID
)
RETURNS TABLE (
    referrer_id UUID,
    referrer_name TEXT,
    commission_amount DECIMAL(10,2),
    rule_id UUID,
    calculation_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_rule RECORD;
    v_amount DECIMAL(10,2);
BEGIN
    -- Buscar dados do agendamento
    SELECT 
        a.id,
        a.tenant_id,
        a.booked_by_id,
        a.service_id,
        a.insurance_id,
        COALESCE(s.price, 0) AS service_price,
        p.full_name AS referrer_name
    INTO v_appointment
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id
    WHERE a.id = p_appointment_id;

    -- Se não tem booked_by_id, não há comissão de captação
    IF v_appointment.booked_by_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar regra de captação aplicável
    SELECT cr.*
    INTO v_rule
    FROM public.commission_rules cr
    WHERE cr.tenant_id = v_appointment.tenant_id
    AND cr.professional_id = v_appointment.booked_by_id
    AND cr.rule_type = 'referral'
    AND cr.is_active = TRUE
    ORDER BY cr.priority DESC
    LIMIT 1;

    -- Se não encontrou regra específica de captação, não há comissão
    IF v_rule.id IS NULL THEN
        RETURN;
    END IF;

    -- Calcular valor da comissão
    IF v_rule.calculation_type = 'percentage' THEN
        v_amount := (v_appointment.service_price * v_rule.value) / 100;
    ELSIF v_rule.calculation_type = 'fixed' THEN
        v_amount := v_rule.value;
    ELSE
        v_amount := 0;
    END IF;

    -- Retornar resultado
    RETURN QUERY SELECT 
        v_appointment.booked_by_id,
        v_appointment.referrer_name,
        v_amount,
        v_rule.id,
        v_rule.calculation_type::TEXT;
END;
$$;

-- 6. Atualizar RPC complete_appointment_with_sale para incluir comissão de captação
-- (A lógica será adicionada na aplicação para não quebrar a RPC existente)

-- 7. Criar view para relatório de captação
CREATE OR REPLACE VIEW public.v_referral_report AS
SELECT 
    a.tenant_id,
    a.booked_by_id AS referrer_id,
    p.full_name AS referrer_name,
    p.professional_type AS referrer_role,
    DATE_TRUNC('month', a.scheduled_at) AS month,
    COUNT(DISTINCT a.id) AS total_appointments,
    COUNT(DISTINCT a.client_id) AS unique_patients,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed_appointments,
    COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS total_revenue,
    COALESCE(SUM(cp.amount), 0) AS total_commission
FROM public.appointments a
LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id
LEFT JOIN public.services s ON s.id = a.service_id
LEFT JOIN public.commission_payments cp ON cp.appointment_id = a.id 
    AND cp.professional_id = a.booked_by_id
WHERE a.booked_by_id IS NOT NULL
GROUP BY 
    a.tenant_id,
    a.booked_by_id,
    p.full_name,
    p.professional_type,
    DATE_TRUNC('month', a.scheduled_at);

-- 8. RLS para a view (via função)
CREATE OR REPLACE FUNCTION public.get_referral_report(
    p_tenant_id UUID,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL,
    p_referrer_id UUID DEFAULT NULL
)
RETURNS TABLE (
    referrer_id UUID,
    referrer_name TEXT,
    referrer_role TEXT,
    month TIMESTAMPTZ,
    total_appointments BIGINT,
    unique_patients BIGINT,
    completed_appointments BIGINT,
    total_revenue DECIMAL,
    total_commission DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.referrer_id,
        v.referrer_name,
        v.referrer_role,
        v.month,
        v.total_appointments,
        v.unique_patients,
        v.completed_appointments,
        v.total_revenue,
        v.total_commission
    FROM public.v_referral_report v
    WHERE v.tenant_id = p_tenant_id
    AND (p_from_date IS NULL OR v.month >= p_from_date)
    AND (p_to_date IS NULL OR v.month <= p_to_date)
    AND (p_referrer_id IS NULL OR v.referrer_id = p_referrer_id)
    ORDER BY v.month DESC, v.total_revenue DESC;
END;
$$;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_referral_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_report(UUID, DATE, DATE, UUID) TO authenticated;
