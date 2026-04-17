CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  -- Comiss├úo ├® criada pelo RPC complete_appointment_with_sale, n├úo pelo trigger

  RETURN NEW;

END;

$function$;