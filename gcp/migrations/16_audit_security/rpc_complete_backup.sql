CREATE OR REPLACE FUNCTION public.complete_backup(p_log_id uuid, p_checksum text, p_duration_seconds integer DEFAULT NULL::integer, p_size_bytes bigint DEFAULT NULL::bigint, p_records_count bigint DEFAULT NULL::bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE backup_logs

  SET 

    status = 'completed',

    completed_at = NOW(),

    checksum_value = p_checksum,

    duration_seconds = COALESCE(p_duration_seconds, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER),

    size_bytes = COALESCE(p_size_bytes, size_bytes),

    records_count = COALESCE(p_records_count, records_count)

  WHERE id = p_log_id;

  

  RETURN FOUND;

END;

$function$;