CREATE OR REPLACE FUNCTION public.calc_tempo_espera(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(media numeric, minimo numeric, maximo numeric, p90 numeric, total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    ROUND(AVG(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as media,

    ROUND(MIN(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as minimo,

    ROUND(MAX(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as maximo,

    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as p90,

    COUNT(*)::INTEGER as total

  FROM appointments a

  JOIN triages t ON t.appointment_id = a.id

  WHERE a.tenant_id = p_tenant_id

    AND a.date BETWEEN p_inicio AND p_fim

    AND a.status = 'completed'

    AND t.created_at IS NOT NULL

    AND a.start_time IS NOT NULL

    AND a.start_time > t.created_at;

END;

$function$;