CREATE OR REPLACE FUNCTION public.hc_recalc_tier(p_lifetime_earned integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$

  SELECT CASE

    WHEN p_lifetime_earned >= 1000 THEN 'platinum'

    WHEN p_lifetime_earned >= 500  THEN 'gold'

    WHEN p_lifetime_earned >= 200  THEN 'silver'

    ELSE 'bronze'

  END;

$function$;