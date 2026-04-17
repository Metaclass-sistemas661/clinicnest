CREATE OR REPLACE FUNCTION public.set_server_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF NEW.server_timestamp IS NULL THEN

    NEW.server_timestamp := NOW();

  END IF;

  RETURN NEW;

END;

$function$;