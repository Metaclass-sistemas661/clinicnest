CREATE OR REPLACE FUNCTION public.generate_adverse_event_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_year TEXT := EXTRACT(YEAR FROM NOW())::TEXT;

  v_count INTEGER;

BEGIN

  SELECT COUNT(*) + 1 INTO v_count

  FROM adverse_events

  WHERE tenant_id = p_tenant_id

    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  

  RETURN 'EA-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

END;

$function$;