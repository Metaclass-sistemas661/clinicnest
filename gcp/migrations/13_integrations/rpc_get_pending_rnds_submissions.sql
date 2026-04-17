CREATE OR REPLACE FUNCTION public.get_pending_rnds_submissions(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, tenant_id uuid, resource_type rnds_resource_type, resource_id uuid, fhir_bundle jsonb, attempt_count integer, scheduled_at timestamp with time zone, rnds_cnes character varying, rnds_uf character varying, rnds_environment character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    s.id,

    s.tenant_id,

    s.resource_type,

    s.resource_id,

    s.fhir_bundle,

    s.attempt_count,

    s.scheduled_at,

    t.rnds_cnes,

    t.rnds_uf,

    t.rnds_environment

  FROM rnds_submissions s

  JOIN tenants t ON t.id = s.tenant_id

  WHERE s.status IN ('pending', 'retry')

    AND s.scheduled_at <= NOW()

    AND (s.next_retry_at IS NULL OR s.next_retry_at <= NOW())

    AND s.attempt_count < s.max_attempts

    AND t.rnds_enabled = TRUE

  ORDER BY s.scheduled_at ASC

  LIMIT p_limit;

END;

$function$;