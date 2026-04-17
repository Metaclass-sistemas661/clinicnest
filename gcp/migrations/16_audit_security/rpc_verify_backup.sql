CREATE OR REPLACE FUNCTION public.verify_backup(p_log_id uuid, p_verification_checksum text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(verified boolean, match_result boolean, original_checksum text, verification_checksum text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_original_checksum TEXT;

  v_match BOOLEAN;

  v_tenant_id UUID;

BEGIN

  -- Buscar checksum original

  SELECT checksum_value, tenant_id 

  INTO v_original_checksum, v_tenant_id

  FROM backup_logs

  WHERE id = p_log_id;

  

  IF v_original_checksum IS NULL THEN

    RETURN QUERY SELECT false, false, ''::TEXT, p_verification_checksum;

    RETURN;

  END IF;

  

  -- Comparar checksums

  v_match := (v_original_checksum = p_verification_checksum);

  

  -- Atualizar log

  UPDATE backup_logs

  SET 

    status = CASE WHEN v_match THEN 'verified' ELSE 'corrupted' END,

    verification_checksum = p_verification_checksum,

    verified_at = NOW(),

    verified_by = COALESCE(p_user_id, current_setting('app.current_user_id')::uuid)

  WHERE id = p_log_id;

  

  -- Registrar verifica├º├úo

  INSERT INTO backup_verifications (

    tenant_id, backup_log_id, verification_type, status,

    checksum_match, performed_by

  ) VALUES (

    v_tenant_id, p_log_id, 'checksum',

    CASE WHEN v_match THEN 'passed' ELSE 'failed' END,

    v_match, COALESCE(p_user_id, current_setting('app.current_user_id')::uuid)

  );

  

  RETURN QUERY SELECT true, v_match, v_original_checksum, p_verification_checksum;

END;

$function$;