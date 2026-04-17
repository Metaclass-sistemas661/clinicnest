CREATE OR REPLACE FUNCTION public.update_overdue_invoices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  UPDATE public.patient_invoices

  SET status = 'overdue', updated_at = now()

  WHERE status = 'pending' AND due_date < CURRENT_DATE;

END;

$function$;