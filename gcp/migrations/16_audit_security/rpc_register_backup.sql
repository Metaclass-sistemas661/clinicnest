CREATE OR REPLACE FUNCTION public.register_backup(p_tenant_id uuid, p_backup_id text, p_backup_type text, p_size_bytes bigint DEFAULT NULL::bigint, p_tables_count integer DEFAULT NULL::integer, p_records_count bigint DEFAULT NULL::bigint, p_storage_location text DEFAULT NULL::text, p_storage_provider text DEFAULT 'supabase'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_log_id UUID;

  v_retention_days INTEGER;

BEGIN

  -- Buscar pol├¡tica de reten├º├úo

  SELECT retention_days INTO v_retention_days

  FROM backup_retention_policies

  WHERE tenant_id = p_tenant_id

    AND (backup_type = p_backup_type OR backup_type = 'all')

    AND enabled = true

  ORDER BY backup_type DESC

  LIMIT 1;

  

  v_retention_days := COALESCE(v_retention_days, 365);

  

  INSERT INTO backup_logs (

    tenant_id, backup_id, backup_type, started_at,

    size_bytes, tables_count, records_count,

    storage_location, storage_provider,

    retention_days, expires_at, metadata

  ) VALUES (

    p_tenant_id, p_backup_id, p_backup_type, NOW(),

    p_size_bytes, p_tables_count, p_records_count,

    p_storage_location, p_storage_provider,

    v_retention_days, NOW() + (v_retention_days || ' days')::INTERVAL, p_metadata

  )

  RETURNING id INTO v_log_id;

  

  RETURN v_log_id;

END;

$function$;