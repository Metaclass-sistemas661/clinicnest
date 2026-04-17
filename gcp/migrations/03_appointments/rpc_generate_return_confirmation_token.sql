CREATE OR REPLACE FUNCTION public.generate_return_confirmation_token()
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

  result TEXT := '';

  i INTEGER;

BEGIN

  FOR i IN 1..32 LOOP

    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);

  END LOOP;

  RETURN result;

END;

$function$;