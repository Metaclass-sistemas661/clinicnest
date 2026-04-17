CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$

    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;

$function$;