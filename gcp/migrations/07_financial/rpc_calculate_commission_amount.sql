CREATE OR REPLACE FUNCTION public.calculate_commission_amount(p_calculation_type commission_calculation_type, p_value numeric, p_tier_config jsonb, p_service_price numeric, p_monthly_revenue numeric DEFAULT 0)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$

DECLARE

    v_tier RECORD;

    v_applicable_rate DECIMAL(10,2);

BEGIN

    IF p_calculation_type = 'fixed' THEN

        RETURN p_value;

    ELSIF p_calculation_type = 'percentage' THEN

        RETURN ROUND((p_service_price * p_value) / 100, 2);

    ELSIF p_calculation_type = 'tiered' AND p_tier_config IS NOT NULL THEN

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

$function$;