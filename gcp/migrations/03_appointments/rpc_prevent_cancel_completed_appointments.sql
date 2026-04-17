CREATE OR REPLACE FUNCTION public.prevent_cancel_completed_appointments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin

  if old.status = 'completed' and new.status = 'cancelled' then

    raise exception 'N├úo ├® permitido cancelar um agendamento conclu├¡do';

  end if;

  return new;

end;

$function$;