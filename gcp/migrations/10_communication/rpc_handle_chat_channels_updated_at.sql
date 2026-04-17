CREATE OR REPLACE FUNCTION public.handle_chat_channels_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  NEW.updated_at = now();

  RETURN NEW;

END;

$function$;