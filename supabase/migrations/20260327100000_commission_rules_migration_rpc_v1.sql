-- Migration: Sub-fase 31A — Parte 2: Migração de dados e RPC
-- Migra dados existentes e cria função para buscar regra aplicável

-- 1. Migrar dados existentes de professional_commissions para commission_rules
INSERT INTO public.commission_rules (
    tenant_id,
    professional_id,
    rule_type,
    calculation_type,
    value,
    priority,
    is_active,
    created_by,
    created_at
)
SELECT 
    pc.tenant_id,
    pc.user_id,
    'default'::public.commission_rule_type,
    CASE 
        WHEN pc.type::text = 'percentage' THEN 'percentage'::public.commission_calculation_type
        ELSE 'fixed'::public.commission_calculation_type
    END,
    pc.value,
    0, -- priority default
    TRUE,
    pc.created_by,
    pc.created_at
FROM public.professional_commissions pc
WHERE pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission'
ON CONFLICT DO NOTHING;

-- 2. Criar função para buscar regra de comissão aplicável
CREATE OR REPLACE FUNCTION public.get_applicable_commission_rule(
    p_tenant_id UUID,
    p_professional_id UUID,
    p_service_id UUID DEFAULT NULL,
    p_insurance_id UUID DEFAULT NULL,
    p_procedure_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    rule_id UUID,
    rule_type public.commission_rule_type,
    calculation_type public.commission_calculation_type,
    value DECIMAL(10,2),
    tier_config JSONB,
    is_inverted BOOLEAN,
    priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Retorna a regra mais específica (maior prioridade) que se aplica
    -- Ordem de prioridade: procedure (30) > service (20) > insurance (10) > default (0)
    RETURN QUERY
    SELECT 
        cr.id AS rule_id,
        cr.rule_type,
        cr.calculation_type,
        cr.value,
        cr.tier_config,
        cr.is_inverted,
        cr.priority
    FROM public.commission_rules cr
    WHERE cr.tenant_id = p_tenant_id
      AND cr.professional_id = p_professional_id
      AND cr.is_active = TRUE
      AND (
          -- Regra por procedimento (mais específica)
          (cr.rule_type = 'procedure' AND cr.procedure_code = p_procedure_code AND p_procedure_code IS NOT NULL)
          OR
          -- Regra por serviço
          (cr.rule_type = 'service' AND cr.service_id = p_service_id AND p_service_id IS NOT NULL)
          OR
          -- Regra por convênio
          (cr.rule_type = 'insurance' AND cr.insurance_id = p_insurance_id AND p_insurance_id IS NOT NULL)
          OR
          -- Regra default (fallback)
          (cr.rule_type = 'default')
      )
    ORDER BY cr.priority DESC, cr.created_at DESC
    LIMIT 1;
END;
$$;

-- 3. Função auxiliar para calcular comissão com suporte a tiers
CREATE OR REPLACE FUNCTION public.calculate_commission_amount(
    p_calculation_type public.commission_calculation_type,
    p_value DECIMAL(10,2),
    p_tier_config JSONB,
    p_service_price DECIMAL(10,2),
    p_monthly_revenue DECIMAL(10,2) DEFAULT 0
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_commission DECIMAL(10,2) := 0;
    v_tier RECORD;
    v_applicable_rate DECIMAL(10,2);
BEGIN
    IF p_calculation_type = 'fixed' THEN
        RETURN p_value;
    ELSIF p_calculation_type = 'percentage' THEN
        RETURN ROUND((p_service_price * p_value) / 100, 2);
    ELSIF p_calculation_type = 'tiered' AND p_tier_config IS NOT NULL THEN
        -- Encontrar a faixa aplicável baseada no faturamento mensal
        v_applicable_rate := p_value; -- fallback para o valor base
        
        FOR v_tier IN 
            SELECT 
                (tier->>'min')::DECIMAL AS tier_min,
                (tier->>'max')::DECIMAL AS tier_max,
                (tier->>'value')::DECIMAL AS tier_value
            FROM jsonb_array_elements(p_tier_config) AS tier
            ORDER BY (tier->>'min')::DECIMAL ASC
        LOOP
            IF p_monthly_revenue >= v_tier.tier_min 
               AND (v_tier.tier_max IS NULL OR p_monthly_revenue <= v_tier.tier_max) THEN
                v_applicable_rate := v_tier.tier_value;
            END IF;
        END LOOP;
        
        RETURN ROUND((p_service_price * v_applicable_rate) / 100, 2);
    END IF;
    
    RETURN 0;
END;
$$;

-- 4. Grants
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicable_commission_rule(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_commission_amount(public.commission_calculation_type, DECIMAL, JSONB, DECIMAL, DECIMAL) TO authenticated;
