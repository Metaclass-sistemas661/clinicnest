CREATE OR REPLACE FUNCTION public.get_backup_report(p_tenant_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(total_backups bigint, successful_backups bigint, failed_backups bigint, verified_backups bigint, corrupted_backups bigint, total_size_gb numeric, avg_duration_minutes numeric, last_backup_at timestamp with time zone, last_verified_at timestamp with time zone, compliance_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_start DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');

  v_end DATE := COALESCE(p_end_date, CURRENT_DATE);

  v_total BIGINT;

  v_successful BIGINT;

  v_failed BIGINT;

  v_verified BIGINT;

  v_corrupted BIGINT;

  v_size NUMERIC;

  v_duration NUMERIC;

  v_last_backup TIMESTAMPTZ;

  v_last_verified TIMESTAMPTZ;

  v_compliance TEXT;

BEGIN

  SELECT 

    COUNT(*),

    COUNT(*) FILTER (WHERE status IN ('completed', 'verified')),

    COUNT(*) FILTER (WHERE status = 'failed'),

    COUNT(*) FILTER (WHERE status = 'verified'),

    COUNT(*) FILTER (WHERE status = 'corrupted'),

    COALESCE(SUM(size_bytes) / 1073741824.0, 0),

    COALESCE(AVG(duration_seconds) / 60.0, 0),

    MAX(completed_at),

    MAX(verified_at)

  INTO v_total, v_successful, v_failed, v_verified, v_corrupted, v_size, v_duration, v_last_backup, v_last_verified

  FROM backup_logs

  WHERE tenant_id = p_tenant_id

    AND created_at >= v_start

    AND created_at <= v_end + INTERVAL '1 day';

  

  -- Determinar status de compliance SBIS

  IF v_corrupted > 0 THEN

    v_compliance := 'NON_COMPLIANT';

  ELSIF v_last_backup IS NULL OR v_last_backup < NOW() - INTERVAL '24 hours' THEN

    v_compliance := 'WARNING';

  ELSIF v_verified = 0 THEN

    v_compliance := 'PENDING_VERIFICATION';

  ELSIF v_failed > v_successful * 0.1 THEN

    v_compliance := 'WARNING';

  ELSE

    v_compliance := 'COMPLIANT';

  END IF;

  

  RETURN QUERY SELECT 

    v_total, v_successful, v_failed, v_verified, v_corrupted,

    v_size, v_duration, v_last_backup, v_last_verified, v_compliance;

END;

$function$;