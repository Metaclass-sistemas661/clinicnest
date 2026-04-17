CREATE OR REPLACE FUNCTION public.get_patient_financial_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

  v_total_pending numeric;

  v_total_overdue numeric;

  v_next_due_date date;

  v_next_due_amount numeric;

  v_last_payment_date timestamptz;

  v_last_payment_amount numeric;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN

    RETURN jsonb_build_object('error', 'not_linked');

  END IF;



  SELECT COALESCE(SUM(amount), 0) INTO v_total_pending

  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'pending';



  SELECT COALESCE(SUM(amount), 0) INTO v_total_overdue

  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'overdue';



  SELECT due_date, amount INTO v_next_due_date, v_next_due_amount

  FROM public.patient_invoices

  WHERE client_id = v_client_id AND status IN ('pending', 'overdue')

  ORDER BY due_date ASC LIMIT 1;



  SELECT pp.paid_at, pp.amount INTO v_last_payment_date, v_last_payment_amount

  FROM public.patient_payments pp

  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id

  WHERE pi.client_id = v_client_id AND pp.status = 'completed'

  ORDER BY pp.paid_at DESC LIMIT 1;



  RETURN jsonb_build_object(

    'total_pending', v_total_pending,

    'total_overdue', v_total_overdue,

    'total_due', v_total_pending + v_total_overdue,

    'next_due_date', v_next_due_date,

    'next_due_amount', v_next_due_amount,

    'last_payment_date', v_last_payment_date,

    'last_payment_amount', v_last_payment_amount

  );

END;

$function$;