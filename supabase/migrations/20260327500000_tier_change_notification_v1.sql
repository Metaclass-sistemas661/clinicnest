-- Migration: Notificação de mudança de faixa de comissão
-- Cria função e trigger para notificar profissionais quando mudam de faixa

-- 1. Tabela para rastrear a última faixa conhecida do profissional
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

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_tier_tracking_professional 
ON public.professional_tier_tracking(professional_id);

CREATE INDEX IF NOT EXISTS idx_tier_tracking_tenant 
ON public.professional_tier_tracking(tenant_id);

-- 3. RLS
ALTER TABLE public.professional_tier_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their tier tracking"
ON public.professional_tier_tracking FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- 4. Função para verificar e notificar mudança de faixa
CREATE OR REPLACE FUNCTION public.check_and_notify_tier_change(
    p_tenant_id UUID,
    p_professional_id UUID
)
RETURNS TABLE (
    tier_changed BOOLEAN,
    old_tier_value DECIMAL,
    new_tier_value DECIMAL,
    monthly_revenue DECIMAL,
    notification_sent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_monthly_revenue DECIMAL(12,2);
    v_current_tier_index INTEGER := 0;
    v_current_tier_value DECIMAL(5,2) := 0;
    v_old_tier_index INTEGER;
    v_old_tier_value DECIMAL(5,2);
    v_tier RECORD;
    v_tier_idx INTEGER := 0;
    v_tracking RECORD;
    v_notification_title TEXT;
    v_notification_body TEXT;
BEGIN
    -- Buscar regra escalonada ativa do profissional
    SELECT cr.* INTO v_rule
    FROM public.commission_rules cr
    WHERE cr.tenant_id = p_tenant_id
    AND cr.professional_id = p_professional_id
    AND cr.calculation_type = 'tiered'
    AND cr.is_active = TRUE
    ORDER BY cr.priority DESC
    LIMIT 1;

    -- Se não tem regra escalonada, retornar sem mudança
    IF v_rule.id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, FALSE;
        RETURN;
    END IF;

    -- Calcular faturamento do mês atual
    SELECT COALESCE(SUM(a.price), 0) INTO v_monthly_revenue
    FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
    AND a.professional_id = p_professional_id
    AND a.status = 'completed'
    AND a.scheduled_at >= DATE_TRUNC('month', NOW())
    AND a.scheduled_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';

    -- Encontrar faixa atual baseada no faturamento
    FOR v_tier IN 
        SELECT 
            (tier->>'min')::DECIMAL AS tier_min,
            (tier->>'max')::DECIMAL AS tier_max,
            (tier->>'value')::DECIMAL AS tier_value
        FROM jsonb_array_elements(v_rule.tier_config) AS tier
        ORDER BY (tier->>'min')::DECIMAL ASC
    LOOP
        IF v_monthly_revenue >= v_tier.tier_min 
           AND (v_tier.tier_max IS NULL OR v_monthly_revenue <= v_tier.tier_max) THEN
            v_current_tier_index := v_tier_idx;
            v_current_tier_value := v_tier.tier_value;
        END IF;
        v_tier_idx := v_tier_idx + 1;
    END LOOP;

    -- Buscar tracking existente
    SELECT * INTO v_tracking
    FROM public.professional_tier_tracking
    WHERE tenant_id = p_tenant_id
    AND professional_id = p_professional_id
    AND rule_id = v_rule.id;

    -- Se não existe tracking, criar
    IF v_tracking.id IS NULL THEN
        INSERT INTO public.professional_tier_tracking (
            tenant_id, professional_id, rule_id, 
            current_tier_index, current_tier_value, monthly_revenue
        ) VALUES (
            p_tenant_id, p_professional_id, v_rule.id,
            v_current_tier_index, v_current_tier_value, v_monthly_revenue
        );
        
        RETURN QUERY SELECT FALSE, v_current_tier_value, v_current_tier_value, v_monthly_revenue, FALSE;
        RETURN;
    END IF;

    v_old_tier_index := v_tracking.current_tier_index;
    v_old_tier_value := v_tracking.current_tier_value;

    -- Verificar se houve mudança de faixa
    IF v_current_tier_index != v_old_tier_index THEN
        -- Atualizar tracking
        UPDATE public.professional_tier_tracking
        SET current_tier_index = v_current_tier_index,
            current_tier_value = v_current_tier_value,
            monthly_revenue = v_monthly_revenue,
            last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_tracking.id;

        -- Criar notificação
        IF v_current_tier_value > v_old_tier_value THEN
            v_notification_title := 'Parabéns! Sua comissão aumentou! 🎉';
            v_notification_body := format(
                'Você atingiu a faixa de %s%% de comissão! Continue assim!',
                v_current_tier_value
            );
        ELSE
            v_notification_title := 'Sua faixa de comissão mudou';
            v_notification_body := format(
                'Sua comissão atual é de %s%%. Aumente seu faturamento para subir de faixa!',
                v_current_tier_value
            );
        END IF;

        -- Inserir notificação
        INSERT INTO public.notifications (
            tenant_id,
            user_id,
            type,
            title,
            body,
            data
        ) VALUES (
            p_tenant_id,
            p_professional_id,
            'tier_change',
            v_notification_title,
            v_notification_body,
            jsonb_build_object(
                'old_tier', v_old_tier_value,
                'new_tier', v_current_tier_value,
                'monthly_revenue', v_monthly_revenue,
                'rule_id', v_rule.id
            )
        );

        RETURN QUERY SELECT TRUE, v_old_tier_value, v_current_tier_value, v_monthly_revenue, TRUE;
        RETURN;
    ELSE
        -- Apenas atualizar o faturamento
        UPDATE public.professional_tier_tracking
        SET monthly_revenue = v_monthly_revenue,
            last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_tracking.id;

        RETURN QUERY SELECT FALSE, v_current_tier_value, v_current_tier_value, v_monthly_revenue, FALSE;
        RETURN;
    END IF;
END;
$$;

-- 5. Trigger para verificar mudança de faixa após conclusão de agendamento
CREATE OR REPLACE FUNCTION public.trigger_check_tier_on_appointment_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Só verificar se o status mudou para 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        PERFORM public.check_and_notify_tier_change(NEW.tenant_id, NEW.professional_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger (drop se existir para evitar duplicação)
DROP TRIGGER IF EXISTS trg_check_tier_on_appointment_complete ON public.appointments;

CREATE TRIGGER trg_check_tier_on_appointment_complete
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_tier_on_appointment_complete();

-- 6. Grants
GRANT SELECT, INSERT, UPDATE ON public.professional_tier_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_notify_tier_change(UUID, UUID) TO authenticated;
