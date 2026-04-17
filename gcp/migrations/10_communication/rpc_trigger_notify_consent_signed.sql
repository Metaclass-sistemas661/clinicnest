CREATE OR REPLACE FUNCTION public.trigger_notify_consent_signed()
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

    'consent_signed',

    'queued',

    jsonb_build_object(

      'consent_id', NEW.id,

      'template_id', NEW.template_id

    )

  );

  RETURN NEW;

END;

$function$;