CREATE OR REPLACE FUNCTION public.support_messages_enforce_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NEW.tenant_id IS NULL THEN

    SELECT t.tenant_id INTO NEW.tenant_id

    FROM public.support_tickets t

    WHERE t.id = NEW.ticket_id;

  END IF;



  IF NEW.tenant_id IS NULL THEN

    RAISE EXCEPTION 'Ticket not found';

  END IF;



  IF EXISTS (

    SELECT 1

    FROM public.support_tickets t

    WHERE t.id = NEW.ticket_id

      AND t.tenant_id <> NEW.tenant_id

  ) THEN

    RAISE EXCEPTION 'Tenant mismatch';

  END IF;



  UPDATE public.support_tickets

    SET last_message_at = now(),

        updated_at = now()

  WHERE id = NEW.ticket_id;



  RETURN NEW;

END;

$function$;