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
