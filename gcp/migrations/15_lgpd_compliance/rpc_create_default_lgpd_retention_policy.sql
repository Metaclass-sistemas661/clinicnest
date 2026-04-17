CREATE OR REPLACE FUNCTION public.create_default_lgpd_retention_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  INSERT INTO public.lgpd_retention_policies (tenant_id)

  VALUES (NEW.id)

  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;

END;

$function$;