CREATE OR REPLACE FUNCTION public.complete_return_reminder(p_reminder_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE return_reminders

  SET 

    status = 'completed',

    updated_at = NOW()

  WHERE id = p_reminder_id;

END;

$function$;