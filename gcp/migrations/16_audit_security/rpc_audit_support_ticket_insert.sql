CREATE OR REPLACE FUNCTION public.audit_support_ticket_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  PERFORM public.log_tenant_action(

    NEW.tenant_id,

    NEW.created_by,

    'support_ticket_created',

    'support_ticket',

    NEW.id::text,

    jsonb_build_object(

      'subject', NEW.subject,

      'category', NEW.category,

      'priority', NEW.priority,

      'channel', NEW.channel,

      'status', NEW.status

    )

  );

  RETURN NEW;

END;

$function$;