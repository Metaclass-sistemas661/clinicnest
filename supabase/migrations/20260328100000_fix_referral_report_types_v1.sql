-- Fix: Corrigir tipos na view e função get_referral_report
-- Problema 1: professional_type é ENUM, não TEXT, causando erro 42804
-- Problema 2: DATE_TRUNC precisa estar no GROUP BY

-- 1. Recriar a view com cast explícito para TEXT e GROUP BY correto
DROP VIEW IF EXISTS public.v_referral_report;

CREATE VIEW public.v_referral_report AS
SELECT 
    a.tenant_id,
    a.booked_by_id AS referrer_id,
    p.full_name AS referrer_name,
    p.professional_type::text AS referrer_role,
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

-- 2. Recriar a função get_referral_report
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
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.get_referral_report(UUID, DATE, DATE, UUID) TO authenticated;

-- ============================================================
-- 3. Atualizar sistema de metas para contexto de clínicas
-- ============================================================

-- Adicionar novos tipos de meta relevantes para clínicas médicas/odontológicas
DO $$ BEGIN
    -- Adicionar novos valores ao enum se não existirem
    ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'appointments_count';
    ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'procedures_count';
    ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'new_patients';
    ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'patient_return_rate';
    ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'ticket_medio';
EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN invalid_parameter_value THEN NULL;
END $$;

-- Adicionar coluna para categoria de serviço (opcional, para metas por especialidade)
ALTER TABLE public.goals 
    ADD COLUMN IF NOT EXISTS service_category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- Comentário atualizado para refletir contexto de clínicas
COMMENT ON TABLE public.goals IS 'Sistema de Metas para Clínicas - Acompanhamento de produtividade de profissionais de saúde';
COMMENT ON COLUMN public.goals.goal_type IS 'Tipo de meta: revenue (faturamento), appointments_count (consultas), procedures_count (procedimentos), new_patients (novos pacientes), patient_return_rate (taxa retorno), ticket_medio (ticket médio), services_count (atendimentos), product_quantity (produtos vendidos), product_revenue (receita produtos)';
