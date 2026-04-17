CREATE OR REPLACE FUNCTION public.get_patient_invoices(p_status text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, description text, amount numeric, due_date date, status text, paid_at timestamp with time zone, paid_amount numeric, payment_method text, payment_url text, appointment_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id INTO v_client_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT pi.id, pi.description, pi.amount, pi.due_date, pi.status,

    pi.paid_at, pi.paid_amount, pi.payment_method, pi.payment_url,

    pi.appointment_id, pi.created_at

  FROM public.patient_invoices pi

  WHERE pi.client_id = v_client_id

    AND (p_status IS NULL OR pi.status = p_status)

    AND (p_from IS NULL OR pi.due_date >= p_from)

    AND (p_to IS NULL OR pi.due_date <= p_to)

  ORDER BY CASE WHEN pi.status IN ('pending', 'overdue') THEN 0 ELSE 1 END, pi.due_date DESC;

END;

$function$;