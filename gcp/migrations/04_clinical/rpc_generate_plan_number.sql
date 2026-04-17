CREATE OR REPLACE FUNCTION public.generate_plan_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_count INTEGER;

  v_year TEXT;

BEGIN

  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count

  FROM public.treatment_plans

  WHERE tenant_id = p_tenant_id

    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  RETURN 'PT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

END;

$function$;