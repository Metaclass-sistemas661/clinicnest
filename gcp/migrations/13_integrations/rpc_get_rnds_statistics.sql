CREATE OR REPLACE FUNCTION public.get_rnds_statistics()
 RETURNS TABLE(total_submissions bigint, pending_count bigint, success_count bigint, error_count bigint, retry_count bigint, success_rate numeric, last_success_at timestamp with time zone, last_error_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  v_tenant_id := get_user_tenant_id(current_setting('app.current_user_id')::uuid);

  

  RETURN QUERY

  SELECT 

    COUNT(*)::BIGINT AS total_submissions,

    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_count,

    COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS success_count,

    COUNT(*) FILTER (WHERE status = 'error')::BIGINT AS error_count,

    COUNT(*) FILTER (WHERE status = 'retry')::BIGINT AS retry_count,

    CASE 

      WHEN COUNT(*) FILTER (WHERE status IN ('success', 'error')) > 0 

      THEN ROUND(

        COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 

        COUNT(*) FILTER (WHERE status IN ('success', 'error'))::NUMERIC * 100, 2

      )

      ELSE 0

    END AS success_rate,

    MAX(processed_at) FILTER (WHERE status = 'success') AS last_success_at,

    MAX(processed_at) FILTER (WHERE status = 'error') AS last_error_at

  FROM rnds_submissions

  WHERE tenant_id = v_tenant_id;

END;

$function$;