CREATE OR REPLACE FUNCTION public.calc_taxa_cancelamento(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(taxa_cancel numeric, taxa_ns numeric, total_agend integer, total_cancel integer, total_ns integer, total_realiz integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    ROUND((COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_cancel,

    ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_ns,

    COUNT(*)::INTEGER as total_agend,

    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER as total_cancel,

    COUNT(*) FILTER (WHERE status = 'no_show')::INTEGER as total_ns,

    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as total_realiz

  FROM appointments

  WHERE tenant_id = p_tenant_id

    AND date BETWEEN p_inicio AND p_fim;

END;

$function$;