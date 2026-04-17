CREATE OR REPLACE FUNCTION public.update_sngpc_transmissoes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$function$;