CREATE OR REPLACE FUNCTION public.raise_app_error(p_code text, p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  RAISE EXCEPTION '%', COALESCE(p_message, 'Erro')

    USING ERRCODE = 'P0001',

          DETAIL = COALESCE(NULLIF(btrim(p_code), ''), 'unknown');

END;

$function$;