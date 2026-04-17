CREATE OR REPLACE FUNCTION public.mark_return_notified(p_reminder_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE return_reminders

  SET 

    status = 'notified',

    last_notification_at = NOW(),

    notification_count = notification_count + 1,

    updated_at = NOW()

  WHERE id = p_reminder_id;

END;

$function$;