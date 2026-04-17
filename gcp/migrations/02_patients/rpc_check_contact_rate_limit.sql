CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_recent_count INTEGER;

BEGIN

  SELECT count(*) INTO v_recent_count

  FROM public.contact_messages

  WHERE email = NEW.email

    AND created_at > now() - interval '1 hour';



  IF v_recent_count >= 5 THEN

    RAISE EXCEPTION 'Rate limit exceeded. Try again later.'

      USING ERRCODE = 'P0001';

  END IF;



  RETURN NEW;

END;

$function$;