CREATE OR REPLACE FUNCTION public.get_client_periograms(p_tenant_id uuid, p_client_id uuid)
 RETURNS TABLE(id uuid, exam_date date, notes text, plaque_index numeric, bleeding_index numeric, avg_probing_depth numeric, sites_over_4mm integer, sites_over_6mm integer, total_sites integer, periodontal_diagnosis text, risk_classification text, professional_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    p.id,

    p.exam_date,

    p.notes,

    p.plaque_index,

    p.bleeding_index,

    p.avg_probing_depth,

    p.sites_over_4mm,

    p.sites_over_6mm,

    p.total_sites,

    p.periodontal_diagnosis,

    p.risk_classification,

    pr.full_name AS professional_name,

    p.created_at

  FROM public.periograms p

  LEFT JOIN public.profiles pr ON p.professional_id = pr.id

  WHERE p.tenant_id = p_tenant_id

    AND p.patient_id = p_client_id

  ORDER BY p.exam_date DESC;

END;

$function$;