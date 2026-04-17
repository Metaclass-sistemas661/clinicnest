CREATE OR REPLACE FUNCTION public.generate_client_access_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_code TEXT;

  v_exists BOOLEAN;

BEGIN

  IF NEW.access_code IS NOT NULL THEN

    RETURN NEW;

  END IF;



  LOOP

    -- Generate PAC-XXXXXX (6 alphanumeric uppercase chars)

    v_code := 'PAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));



    SELECT EXISTS(SELECT 1 FROM public.patients WHERE access_code = v_code) INTO v_exists;



    IF NOT v_exists THEN

      NEW.access_code := v_code;

      EXIT;

    END IF;

  END LOOP;



  RETURN NEW;

END;

$function$;