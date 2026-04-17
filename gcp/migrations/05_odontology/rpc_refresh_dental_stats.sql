CREATE OR REPLACE FUNCTION public.refresh_dental_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dental_stats;

END;

$function$;