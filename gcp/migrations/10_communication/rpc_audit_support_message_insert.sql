CREATE OR REPLACE FUNCTION public.audit_support_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  PERFORM public.log_tenant_action(

    NEW.tenant_id,

    COALESCE(NEW.created_by, current_setting('app.current_user_id')::uuid),

    'support_message_created',

    'support_message',

    NEW.id::text,

    jsonb_build_object(

      'ticket_id', NEW.ticket_id::text,

      'sender', NEW.sender

    )

  );

  RETURN NEW;

END;

$function$;