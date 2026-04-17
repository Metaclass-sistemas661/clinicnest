CREATE OR REPLACE FUNCTION public.get_retention_deletion_attempts(p_tenant_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, attempted_at timestamp with time zone, user_email text, table_name text, client_name text, retention_expires date, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    rda.id,

    rda.attempted_at,

    COALESCE(up.email, 'Sistema') as user_email,

    rda.table_name,

    rda.client_name,

    rda.retention_expires_at as retention_expires,

    rda.reason

  FROM retention_deletion_attempts rda

  LEFT JOIN profiles up ON up.user_id = rda.user_id

  WHERE rda.tenant_id = p_tenant_id

    AND (p_start_date IS NULL OR rda.attempted_at::DATE >= p_start_date)

    AND (p_end_date IS NULL OR rda.attempted_at::DATE <= p_end_date)

  ORDER BY rda.attempted_at DESC;

END;

$function$;