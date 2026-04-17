CREATE OR REPLACE FUNCTION public.generate_certificate_hash(p_certificate_type text, p_content text, p_days_off integer, p_start_date date, p_end_date date, p_cid_code text, p_notes text, p_patient_id uuid, p_issued_at timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_payload TEXT;

  v_hash TEXT;

BEGIN

  -- Construir payload ordenado para hash determin├¡stico

  v_payload := jsonb_build_object(

    'certificate_type', COALESCE(p_certificate_type, ''),

    'cid_code', COALESCE(p_cid_code, ''),

    'content', COALESCE(p_content, ''),

    'days_off', COALESCE(p_days_off, 0),

    'end_date', COALESCE(p_end_date::TEXT, ''),

    'issued_at', COALESCE(p_issued_at::TEXT, ''),

    'notes', COALESCE(p_notes, ''),

    'patient_id', COALESCE(p_patient_id::TEXT, ''),

    'start_date', COALESCE(p_start_date::TEXT, '')

  )::TEXT;



  -- Gerar hash SHA-256

  v_hash := encode(sha256(v_payload::bytea), 'hex');

  

  RETURN v_hash;

END;

$function$;