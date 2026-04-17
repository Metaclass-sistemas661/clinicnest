CREATE OR REPLACE FUNCTION public.audit_appointment_completion_summary_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_actor_user_id uuid := current_setting('app.current_user_id')::uuid;

BEGIN

  PERFORM public.log_tenant_action(

    NEW.tenant_id,

    COALESCE(v_actor_user_id, NULL),

    'appointment_completed',

    'appointment',

    COALESCE(NEW.appointment_id::text, NULL),

    jsonb_build_object(

      'summary_id', NEW.id::text,

      'service_name', NEW.service_name,

      'professional_name', NEW.professional_name,

      'service_profit', NEW.service_profit,

      'product_profit_total', NEW.product_profit_total,

      'total_profit', NEW.total_profit

    )

  );



  RETURN NEW;

END;

$function$;