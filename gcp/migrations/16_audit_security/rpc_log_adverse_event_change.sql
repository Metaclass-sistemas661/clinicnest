CREATE OR REPLACE FUNCTION public.log_adverse_event_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN

    INSERT INTO adverse_events_history (

      adverse_event_id, user_id, action, old_status, new_status

    ) VALUES (

      NEW.id, current_setting('app.current_user_id')::uuid, 'STATUS_CHANGE', OLD.status, NEW.status

    );

  END IF;

  

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$function$;