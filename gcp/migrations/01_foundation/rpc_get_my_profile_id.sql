CREATE OR REPLACE FUNCTION public.get_my_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT id FROM public.profiles WHERE id = current_setting('app.current_user_id')::uuid;

$function$;