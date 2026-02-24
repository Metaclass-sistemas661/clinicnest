-- Fix: Corrigir tipo professional_type na função get_referral_report
-- O erro 42804 ocorre porque professional_type é ENUM e a função espera TEXT

-- 1. Dropar a função existente para recriar com tipos corretos
DROP FUNCTION IF EXISTS public.get_referral_report(UUID, DATE, DATE, UUID);

-- 2. Dropar e recriar a view com cast explícito
DROP VIEW IF EXISTS public.v_referral_report;

CREATE OR REPLACE VIEW public.v_referral_report AS
SELECT 
    a.tenant_id,
    a.booked_by_id AS referrer_id,
    COALESCE(p.full_name, 'Desconhecido') AS referrer_name,
    COALESCE(p.professional_type::text, 'staff') AS referrer_role,
    DATE_TRUNC('month', a.scheduled_at)::timestamptz AS month,
    COUNT(DISTINCT a.id)::bigint AS total_appointments,
    COUNT(DISTINCT a.client_id)::bigint AS unique_patients,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END)::bigint AS completed_appointments,
    COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0)::decimal AS total_revenue,
    COALESCE(SUM(cp.amount), 0)::decimal AS total_commission
FROM public.appointments a
LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id AND p.tenant_id = a.tenant_id
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

-- 3. Recriar a função com tipos explícitos
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
        v.referrer_name::text,
        v.referrer_role::text,
        v.month,
        v.total_appointments,
        v.unique_patients,
        v.completed_appointments,
        v.total_revenue,
        v.total_commission
    FROM public.v_referral_report v
    WHERE v.tenant_id = p_tenant_id
    AND (p_from_date IS NULL OR v.month >= p_from_date::timestamptz)
    AND (p_to_date IS NULL OR v.month <= (p_to_date + INTERVAL '1 day')::timestamptz)
    AND (p_referrer_id IS NULL OR v.referrer_id = p_referrer_id)
    ORDER BY v.month DESC, v.total_revenue DESC;
END;
$$;

-- 4. Garantir permissões
GRANT SELECT ON public.v_referral_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_report(UUID, DATE, DATE, UUID) TO authenticated;
