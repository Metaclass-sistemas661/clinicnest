CREATE OR REPLACE FUNCTION public.get_patient_document_signatures()
 RETURNS TABLE(id uuid, document_type text, document_id uuid, signature_method text, signed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_id uuid;

BEGIN

  SELECT pp.client_id INTO v_patient_id

  FROM patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_patient_id IS NULL THEN

    RETURN;

  END IF;



  RETURN QUERY

  SELECT ds.id, ds.document_type, ds.document_id, ds.signature_method, ds.signed_at

  FROM document_signatures ds

  WHERE ds.patient_id = v_patient_id

  ORDER BY ds.signed_at DESC;

END;

$function$;