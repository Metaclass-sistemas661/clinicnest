CREATE OR REPLACE FUNCTION public.trigger_notify_return_scheduled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  INSERT INTO public.notification_logs (

    tenant_id,

    recipient_type,

    recipient_id,

    channel,

    template_type,

    status,

    metadata

  ) VALUES (

    NEW.tenant_id,

    'patient',

    NEW.patient_id,

    'all',

    'return_scheduled',

    'queued',

    jsonb_build_object(

      'return_id', NEW.id,

      'return_date', NEW.return_date,

      'reason', NEW.reason

    )

  );

  RETURN NEW;

END;

$function$;