CREATE OR REPLACE FUNCTION public.check_return_on_appointment_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- Marca retornos vinculados como completados

    UPDATE return_reminders

    SET status = 'completed', updated_at = NOW()

    WHERE scheduled_appointment_id = NEW.id

      AND status IN ('pending', 'notified', 'scheduled');

    

    -- Tamb├®m verifica se ├® um retorno do mesmo paciente/profissional

    UPDATE return_reminders

    SET status = 'completed', updated_at = NOW()

    WHERE client_id = NEW.client_id

      AND professional_id = NEW.professional_id

      AND status IN ('pending', 'notified')

      AND return_date BETWEEN NEW.date - INTERVAL '7 days' AND NEW.date + INTERVAL '7 days';

  END IF;

  

  RETURN NEW;

END;

$function$;