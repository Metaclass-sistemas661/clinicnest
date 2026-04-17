CREATE OR REPLACE FUNCTION public.seal_consent_pdf(p_consent_id uuid, p_sealed_pdf_path text, p_sealed_pdf_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  UPDATE public.patient_consents SET

    sealed_pdf_path = p_sealed_pdf_path,

    sealed_pdf_hash = p_sealed_pdf_hash,

    sealed_at       = now()

  WHERE id = p_consent_id;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Consent % not found', p_consent_id

      USING ERRCODE = 'P0002';

  END IF;



  RETURN jsonb_build_object(

    'success',    true,

    'consent_id', p_consent_id,

    'sealed_at',  now()

  );

END;

$function$;