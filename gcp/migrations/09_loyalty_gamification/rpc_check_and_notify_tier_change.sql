CREATE OR REPLACE FUNCTION public.check_and_notify_tier_change(p_tenant_id uuid, p_professional_id uuid)
 RETURNS TABLE(tier_changed boolean, old_tier_value numeric, new_tier_value numeric, monthly_revenue numeric, notification_sent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

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



    -- Se n├úo tem regra escalonada, retornar sem mudan├ºa

    IF v_rule.id IS NULL THEN

        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, FALSE;

        RETURN;

    END IF;



    -- Calcular faturamento do m├¬s atual

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



    -- Se n├úo existe tracking, criar

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



    -- Verificar se houve mudan├ºa de faixa

    IF v_current_tier_index != v_old_tier_index THEN

        -- Atualizar tracking

        UPDATE public.professional_tier_tracking

        SET current_tier_index = v_current_tier_index,

            current_tier_value = v_current_tier_value,

            monthly_revenue = v_monthly_revenue,

            last_checked_at = NOW(),

            updated_at = NOW()

        WHERE id = v_tracking.id;



        -- Criar notifica├º├úo

        IF v_current_tier_value > v_old_tier_value THEN

            v_notification_title := 'Parab├®ns! Sua comiss├úo aumentou! ­ƒÄë';

            v_notification_body := format(

                'Voc├¬ atingiu a faixa de %s%% de comiss├úo! Continue assim!',

                v_current_tier_value

            );

        ELSE

            v_notification_title := 'Sua faixa de comiss├úo mudou';

            v_notification_body := format(

                'Sua comiss├úo atual ├® de %s%%. Aumente seu faturamento para subir de faixa!',

                v_current_tier_value

            );

        END IF;



        -- Inserir notifica├º├úo

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

$function$;