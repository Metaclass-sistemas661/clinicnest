-- RPC: cleanup_patient_access_attempts
-- Deletes access attempt records older than 30 days
-- Should be called periodically (e.g. pg_cron or scheduled Cloud Function)

CREATE OR REPLACE FUNCTION public.cleanup_patient_access_attempts()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  DELETE FROM public.patient_access_attempts
  WHERE created_at < now() - interval '30 days';
$function$;
