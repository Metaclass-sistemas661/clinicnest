CREATE OR REPLACE FUNCTION public.get_tuss_odonto_prices(p_tenant_id uuid)
 RETURNS TABLE(id uuid, tuss_code text, description text, default_price numeric, category text, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT id, tuss_code, description, default_price, category, is_active

  FROM public.tuss_odonto_prices

  WHERE tenant_id = p_tenant_id AND is_active = true

  ORDER BY category, tuss_code;

$function$;