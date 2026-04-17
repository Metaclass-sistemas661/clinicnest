CREATE OR REPLACE FUNCTION public.create_nps_response_for_completed_appointment_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin

  if new.status = 'completed' and (old.status is distinct from 'completed') then

    insert into public.nps_responses(tenant_id, appointment_id, client_id)

    select new.tenant_id, new.id, new.client_id

    where not exists (

      select 1 from public.nps_responses r

      where r.appointment_id = new.id

    );

  end if;

  return new;

end;

$function$;