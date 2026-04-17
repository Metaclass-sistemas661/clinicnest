CREATE OR REPLACE FUNCTION public.calc_retorno_nao_programado(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(taxa numeric, retornos_7dias integer, total_atend integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  WITH atendimentos AS (

    SELECT 

      a.id,

      a.client_id,

      a.date,

      LAG(a.date) OVER (PARTITION BY a.client_id ORDER BY a.date) as data_anterior

    FROM appointments a

    WHERE a.tenant_id = p_tenant_id

      AND a.status = 'completed'

      AND a.date BETWEEN p_inicio AND p_fim

  )

  SELECT 

    ROUND((COUNT(*) FILTER (WHERE date - data_anterior <= 7)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa,

    COUNT(*) FILTER (WHERE date - data_anterior <= 7)::INTEGER as retornos_7dias,

    COUNT(*)::INTEGER as total_atend

  FROM atendimentos;

END;

$function$;