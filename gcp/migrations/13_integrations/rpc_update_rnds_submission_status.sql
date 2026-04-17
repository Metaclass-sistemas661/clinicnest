CREATE OR REPLACE FUNCTION public.update_rnds_submission_status(p_submission_id uuid, p_status rnds_submission_status, p_rnds_protocol character varying DEFAULT NULL::character varying, p_rnds_response jsonb DEFAULT NULL::jsonb, p_error_message text DEFAULT NULL::text, p_error_code character varying DEFAULT NULL::character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_next_retry TIMESTAMPTZ;

  v_attempt INTEGER;

BEGIN

  SELECT attempt_count INTO v_attempt FROM rnds_submissions WHERE id = p_submission_id;

  

  IF p_status = 'retry' THEN

    v_next_retry := NOW() + (POWER(2, v_attempt) * INTERVAL '1 minute');

  END IF;

  

  UPDATE rnds_submissions SET

    status = p_status,

    rnds_protocol = COALESCE(p_rnds_protocol, rnds_protocol),

    rnds_response = COALESCE(p_rnds_response, rnds_response),

    error_message = p_error_message,

    error_code = p_error_code,

    attempt_count = attempt_count + 1,

    processed_at = CASE WHEN p_status IN ('success', 'error') THEN NOW() ELSE processed_at END,

    next_retry_at = v_next_retry,

    updated_at = NOW()

  WHERE id = p_submission_id;

  

  IF p_status = 'success' THEN

    UPDATE tenants SET rnds_last_sync_at = NOW()

    WHERE id = (SELECT tenant_id FROM rnds_submissions WHERE id = p_submission_id);

  END IF;

  

  RETURN TRUE;

END;

$function$;