CREATE OR REPLACE FUNCTION public.calc_nps(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(score numeric, promotores integer, neutros integer, detratores integer, total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    ROUND((

      (COUNT(*) FILTER (WHERE rating >= 9)::NUMERIC - COUNT(*) FILTER (WHERE rating <= 6)::NUMERIC) 

      / NULLIF(COUNT(*), 0) * 100

    ), 2) as score,

    COUNT(*) FILTER (WHERE rating >= 9)::INTEGER as promotores,

    COUNT(*) FILTER (WHERE rating BETWEEN 7 AND 8)::INTEGER as neutros,

    COUNT(*) FILTER (WHERE rating <= 6)::INTEGER as detratores,

    COUNT(*)::INTEGER as total

  FROM nps_responses

  WHERE tenant_id = p_tenant_id

    AND created_at::DATE BETWEEN p_inicio AND p_fim;

END;

$function$;