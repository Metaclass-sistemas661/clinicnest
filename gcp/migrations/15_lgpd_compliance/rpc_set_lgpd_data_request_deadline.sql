CREATE OR REPLACE FUNCTION public.set_lgpd_data_request_deadline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NEW.requested_at IS NULL THEN

    NEW.requested_at := now();

  END IF;



  IF NEW.sla_days IS NULL OR NEW.sla_days < 1 THEN

    NEW.sla_days := 15;

  END IF;



  IF TG_OP = 'INSERT'

     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at

     OR NEW.sla_days IS DISTINCT FROM OLD.sla_days

     OR NEW.due_at IS NULL THEN

    NEW.due_at := NEW.requested_at + make_interval(days => NEW.sla_days);

  END IF;



  RETURN NEW;

END;

$function$;