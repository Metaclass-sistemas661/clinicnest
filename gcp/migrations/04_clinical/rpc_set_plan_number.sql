CREATE OR REPLACE FUNCTION public.set_plan_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF NEW.plan_number IS NULL THEN

    NEW.plan_number := public.generate_plan_number(NEW.tenant_id);

  END IF;

  RETURN NEW;

END;

$function$;