-- Migration: Sub-fase 31A — Fundação: Múltiplas Regras de Comissão
-- Cria tabela commission_rules para suportar regras granulares de comissão

-- 1. Criar enum para tipo de regra
DO $$ BEGIN
    CREATE TYPE public.commission_rule_type AS ENUM ('default', 'service', 'insurance', 'procedure', 'sale');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar enum para tipo de cálculo
DO $$ BEGIN
    CREATE TYPE public.commission_calculation_type AS ENUM ('percentage', 'fixed', 'tiered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Criar tabela commission_rules
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    
    -- Tipo de regra (determina qual filtro usar)
    rule_type public.commission_rule_type NOT NULL DEFAULT 'default',
    
    -- Filtros opcionais (dependem do rule_type)
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    insurance_id UUID REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
    procedure_code TEXT, -- Código TUSS
    
    -- Configuração de cálculo
    calculation_type public.commission_calculation_type NOT NULL DEFAULT 'percentage',
    value DECIMAL(10,2) NOT NULL CHECK (value >= 0),
    
    -- Configuração de faixas escalonadas (para calculation_type = 'tiered')
    -- Formato: [{"min": 0, "max": 5000, "value": 30}, {"min": 5001, "max": 10000, "value": 35}]
    tier_config JSONB,
    
    -- Prioridade (maior = mais específico, aplicado primeiro)
    -- Default: 0, Insurance: 10, Service: 20, Procedure: 30
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Repasse invertido (profissional paga à clínica)
    is_inverted BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Auditoria
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_service_rule CHECK (
        rule_type != 'service' OR service_id IS NOT NULL
    ),
    CONSTRAINT valid_insurance_rule CHECK (
        rule_type != 'insurance' OR insurance_id IS NOT NULL
    ),
    CONSTRAINT valid_procedure_rule CHECK (
        rule_type != 'procedure' OR procedure_code IS NOT NULL
    ),
    CONSTRAINT valid_tier_config CHECK (
        calculation_type != 'tiered' OR tier_config IS NOT NULL
    )
);

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_professional 
    ON public.commission_rules(tenant_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_service 
    ON public.commission_rules(tenant_id, service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_insurance 
    ON public.commission_rules(tenant_id, insurance_id) WHERE insurance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_rules_active 
    ON public.commission_rules(tenant_id, professional_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_commission_rules_priority 
    ON public.commission_rules(tenant_id, professional_id, priority DESC);

-- 5. Unique constraint para evitar regras duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_default
    ON public.commission_rules(tenant_id, professional_id)
    WHERE rule_type = 'default' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_service
    ON public.commission_rules(tenant_id, professional_id, service_id)
    WHERE rule_type = 'service' AND service_id IS NOT NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_insurance
    ON public.commission_rules(tenant_id, professional_id, insurance_id)
    WHERE rule_type = 'insurance' AND insurance_id IS NOT NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_procedure
    ON public.commission_rules(tenant_id, professional_id, procedure_code)
    WHERE rule_type = 'procedure' AND procedure_code IS NOT NULL AND is_active = TRUE;

-- 6. Trigger updated_at
DROP TRIGGER IF EXISTS update_commission_rules_updated_at ON public.commission_rules;
CREATE TRIGGER update_commission_rules_updated_at 
    BEFORE UPDATE ON public.commission_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Habilitar RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
DROP POLICY IF EXISTS "commission_rules_select" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rules_admin_all" ON public.commission_rules;

-- SELECT: Profissionais veem suas próprias regras, admins veem todas do tenant
CREATE POLICY "commission_rules_select"
    ON public.commission_rules FOR SELECT
    USING (
        professional_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_rules.tenant_id
            AND ur.role = 'admin'
        )
    );

-- INSERT/UPDATE/DELETE: Apenas admins do tenant
CREATE POLICY "commission_rules_admin_all"
    ON public.commission_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_rules.tenant_id
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_rules.tenant_id
            AND ur.role = 'admin'
        )
    );
