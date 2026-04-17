CREATE OR REPLACE FUNCTION public.cleanup_expired_backups(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_deleted INTEGER;

BEGIN

  WITH deleted AS (

    DELETE FROM backup_logs

    WHERE expires_at < NOW()

      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

      AND status IN ('completed', 'verified')

    RETURNING id

  )

  SELECT COUNT(*) INTO v_deleted FROM deleted;

  

  RETURN v_deleted;

END;

$function$;