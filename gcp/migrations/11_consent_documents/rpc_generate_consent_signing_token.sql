CREATE OR REPLACE FUNCTION public.generate_consent_signing_token()
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_token TEXT;

  v_exists BOOLEAN;

BEGIN

  LOOP

    -- Gera token de 32 caracteres alfanum├®ricos

    v_token := encode(gen_random_bytes(24), 'base64');

    v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');

    v_token := substring(v_token from 1 for 32);

    

    SELECT EXISTS(SELECT 1 FROM public.consent_signing_tokens WHERE token = v_token) INTO v_exists;

    EXIT WHEN NOT v_exists;

  END LOOP;

  

  RETURN v_token;

END;

$function$;