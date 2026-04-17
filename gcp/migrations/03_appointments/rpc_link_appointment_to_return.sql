CREATE OR REPLACE FUNCTION public.link_appointment_to_return(p_reminder_id uuid, p_appointment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE return_reminders

  SET 

    scheduled_appointment_id = p_appointment_id,

    status = 'scheduled',

    updated_at = NOW()

  WHERE id = p_reminder_id;

END;

$function$;