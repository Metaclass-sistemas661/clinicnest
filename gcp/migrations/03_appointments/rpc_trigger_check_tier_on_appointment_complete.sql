CREATE OR REPLACE FUNCTION public.trigger_check_tier_on_appointment_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

    -- S├│ verificar se o status mudou para 'completed'

    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

        PERFORM public.check_and_notify_tier_change(NEW.tenant_id, NEW.professional_id);

    END IF;

    

    RETURN NEW;

END;

$function$;