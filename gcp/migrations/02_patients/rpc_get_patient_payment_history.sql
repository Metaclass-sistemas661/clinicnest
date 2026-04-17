CREATE OR REPLACE FUNCTION public.get_patient_payment_history(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, invoice_id uuid, invoice_description text, amount numeric, payment_method text, status text, paid_at timestamp with time zone, receipt_url text)
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

  SELECT pp.id, pp.invoice_id, pi.description, pp.amount,

    pp.payment_method, pp.status, pp.paid_at, pp.receipt_url

  FROM public.patient_payments pp

  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id

  WHERE pi.client_id = v_client_id

  ORDER BY pp.paid_at DESC LIMIT p_limit OFFSET p_offset;

END;

$function$;