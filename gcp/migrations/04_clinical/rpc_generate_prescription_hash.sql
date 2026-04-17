CREATE OR REPLACE FUNCTION public.generate_prescription_hash(p_prescription_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_rx RECORD;

  v_payload TEXT;

  v_hash TEXT;

BEGIN

  SELECT * INTO v_rx FROM public.prescriptions WHERE id = p_prescription_id;

  

  IF NOT FOUND THEN

    RETURN NULL;

  END IF;



  v_payload := jsonb_build_object(

    'id', v_rx.id,

    'prescription_type', COALESCE(v_rx.prescription_type, ''),

    'medications', COALESCE(v_rx.medications, ''),

    'instructions', COALESCE(v_rx.instructions, ''),

    'issued_at', COALESCE(v_rx.issued_at::TEXT, ''),

    'validity_days', COALESCE(v_rx.validity_days, 0),

    'patient_id', COALESCE(v_rx.patient_id::TEXT, ''),

    'professional_id', COALESCE(v_rx.professional_id::TEXT, '')

  )::TEXT;



  v_hash := encode(sha256(v_payload::bytea), 'hex');

  

  RETURN v_hash;

END;

$function$;