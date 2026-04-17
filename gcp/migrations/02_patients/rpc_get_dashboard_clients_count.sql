CREATE OR REPLACE FUNCTION public.get_dashboard_clients_count(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_count INTEGER := 0;

BEGIN

  -- Seguran├ºa: chamador deve pertencer ao tenant

  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles p 

    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid

  ) THEN

    RETURN 0;

  END IF;



  -- Contar clientes ├║nicos do tenant (garantir filtro correto)

  SELECT COUNT(id)

  INTO v_count

  FROM clients

  WHERE tenant_id = p_tenant_id;



  RETURN COALESCE(v_count, 0)::INTEGER;

END;

$function$;