CREATE OR REPLACE FUNCTION public.set_attendance_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF NEW.attendance_number IS NULL THEN

    NEW.attendance_number := public.next_attendance_number(NEW.tenant_id);

  END IF;

  RETURN NEW;

END;

$function$;