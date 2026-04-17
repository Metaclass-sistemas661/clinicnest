CREATE OR REPLACE FUNCTION public.get_retention_statistics(p_tenant_id uuid)
 RETURNS TABLE(total_clients bigint, clients_with_retention bigint, expiring_this_year bigint, expiring_next_year bigint, already_archived bigint, deletion_attempts_blocked bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id) as total_clients,

    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id AND retention_expires_at IS NOT NULL) as clients_with_retention,

    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 

     AND retention_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 year') as expiring_this_year,

    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 

     AND retention_expires_at BETWEEN CURRENT_DATE + INTERVAL '1 year' AND CURRENT_DATE + INTERVAL '2 years') as expiring_next_year,

    (SELECT COUNT(*) FROM archived_clinical_data WHERE tenant_id = p_tenant_id) as already_archived,

    (SELECT COUNT(*) FROM retention_deletion_attempts WHERE tenant_id = p_tenant_id AND blocked = true) as deletion_attempts_blocked;

END;

$function$;