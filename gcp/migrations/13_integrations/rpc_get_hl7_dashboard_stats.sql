CREATE OR REPLACE FUNCTION public.get_hl7_dashboard_stats(p_tenant_id uuid, p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

    v_result JSON;

BEGIN

    SELECT json_build_object(

        'total_messages', (

            SELECT COUNT(*) FROM hl7_message_log 

            WHERE tenant_id = p_tenant_id 

            AND received_at >= NOW() - (p_days || ' days')::interval

        ),

        'processed', (

            SELECT COUNT(*) FROM hl7_message_log 

            WHERE tenant_id = p_tenant_id 

            AND status = 'processed'

            AND received_at >= NOW() - (p_days || ' days')::interval

        ),

        'failed', (

            SELECT COUNT(*) FROM hl7_message_log 

            WHERE tenant_id = p_tenant_id 

            AND status = 'failed'

            AND received_at >= NOW() - (p_days || ' days')::interval

        ),

        'pending_review', (

            SELECT COUNT(*) FROM hl7_message_log 

            WHERE tenant_id = p_tenant_id 

            AND status = 'failed'

            AND patient_id IS NULL

        ),

        'by_type', (

            SELECT COALESCE(json_agg(json_build_object(

                'type', message_type,

                'count', cnt

            )), '[]'::json)

            FROM (

                SELECT message_type, COUNT(*) as cnt

                FROM hl7_message_log

                WHERE tenant_id = p_tenant_id

                AND received_at >= NOW() - (p_days || ' days')::interval

                GROUP BY message_type

                ORDER BY cnt DESC

            ) t

        ),

        'by_day', (

            SELECT COALESCE(json_agg(json_build_object(

                'date', day,

                'inbound', inbound,

                'outbound', outbound

            ) ORDER BY day), '[]'::json)

            FROM (

                SELECT 

                    DATE(received_at) as day,

                    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,

                    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound

                FROM hl7_message_log

                WHERE tenant_id = p_tenant_id

                AND received_at >= NOW() - (p_days || ' days')::interval

                GROUP BY DATE(received_at)

            ) t

        ),

        'active_connections', (

            SELECT COUNT(*) FROM hl7_connections

            WHERE tenant_id = p_tenant_id AND is_active = TRUE

        )

    ) INTO v_result;

    

    RETURN v_result;

END;

$function$;