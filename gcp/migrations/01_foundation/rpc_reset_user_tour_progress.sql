CREATE OR REPLACE FUNCTION public.reset_user_tour_progress(p_tour_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  DELETE FROM public.user_tour_progress

  WHERE user_id = v_user_id

    AND tour_key = p_tour_key;

END;

$function$;