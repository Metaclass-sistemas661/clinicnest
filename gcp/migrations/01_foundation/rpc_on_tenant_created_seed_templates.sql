CREATE OR REPLACE FUNCTION public.on_tenant_created_seed_templates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  PERFORM public.seed_role_templates_for_tenant(NEW.id);

  RETURN NEW;

END;

$function$;