CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(p_tenant_id uuid, p_start_date date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(feature text, total_calls bigint, total_input_tokens bigint, total_output_tokens bigint, total_cost_usd numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

    RETURN QUERY

    SELECT 

        al.feature,

        COUNT(*)::BIGINT as total_calls,

        COALESCE(SUM(al.input_tokens), 0)::BIGINT as total_input_tokens,

        COALESCE(SUM(al.output_tokens), 0)::BIGINT as total_output_tokens,

        COALESCE(SUM(al.cost_usd), 0)::DECIMAL as total_cost_usd

    FROM ai_usage_log al

    WHERE al.tenant_id = p_tenant_id

      AND al.created_at >= p_start_date

      AND al.created_at < p_end_date + INTERVAL '1 day'

    GROUP BY al.feature

    ORDER BY total_calls DESC;

END;

$function$;