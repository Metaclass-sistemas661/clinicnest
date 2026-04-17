CREATE OR REPLACE FUNCTION public.get_tenant_rnds_config()
 RETURNS TABLE(rnds_enabled boolean, rnds_cnes character varying, rnds_uf character varying, rnds_environment character varying, rnds_auto_send boolean, rnds_last_sync_at timestamp with time zone, has_certificate boolean, certificate_valid_to timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  v_tenant_id := get_user_tenant_id(current_setting('app.current_user_id')::uuid);

  

  RETURN QUERY

  SELECT 

    t.rnds_enabled,

    t.rnds_cnes,

    t.rnds_uf,

    t.rnds_environment,

    t.rnds_auto_send,

    t.rnds_last_sync_at,

    EXISTS(SELECT 1 FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE) AS has_certificate,

    (SELECT c.valid_to FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE ORDER BY c.valid_to DESC LIMIT 1) AS certificate_valid_to

  FROM tenants t

  WHERE t.id = v_tenant_id;

END;

$function$;