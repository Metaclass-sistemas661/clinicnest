CREATE OR REPLACE FUNCTION public.register_appointment_payment(p_appointment_id uuid, p_amount numeric, p_payment_method text DEFAULT 'Dinheiro'::text, p_payment_source text DEFAULT 'particular'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_profile_id UUID;

  v_tenant_id UUID;

  v_appointment RECORD;

  v_receivable_id UUID;

  v_transaction_id UUID;

  v_tx_date DATE;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF p_amount <= 0 THEN

    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero';

  END IF;



  -- Buscar agendamento (CORRIGIDO: procedure_id, patients, patient_id)

  SELECT

    a.*,

    s.name AS service_name,

    c.name AS client_name,

    COALESCE(a.price, s.price, 0)::numeric AS effective_price

  INTO v_appointment

  FROM public.appointments a

  LEFT JOIN public.procedures s ON s.id = a.procedure_id

  LEFT JOIN public.patients c ON c.id = a.patient_id

  WHERE a.id = p_appointment_id;



  IF v_appointment IS NULL THEN

    RAISE EXCEPTION 'Agendamento n├úo encontrado';

  END IF;



  IF v_appointment.status <> 'completed' THEN

    RAISE EXCEPTION 'Agendamento deve estar conclu├¡do para registrar pagamento';

  END IF;



  v_tenant_id := v_appointment.tenant_id;



  -- Verificar permiss├Áes (admin do tenant)

  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem registrar pagamentos';

  END IF;



  -- Buscar profile_id

  SELECT id INTO v_profile_id

  FROM public.profiles

  WHERE user_id = v_user_id AND tenant_id = v_tenant_id

  LIMIT 1;



  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;



  -- Verificar se j├í existe pagamento para este atendimento

  IF EXISTS (

    SELECT 1 FROM public.accounts_receivable

    WHERE appointment_id = p_appointment_id AND status = 'paid'

  ) THEN

    RAISE EXCEPTION 'Este atendimento j├í possui pagamento registrado';

  END IF;



  -- Criar registro em accounts_receivable (client_id mantido se coluna existir)

  INSERT INTO public.accounts_receivable (

    tenant_id, appointment_id, client_id, professional_id,

    service_price, amount_due, amount_paid,

    payment_source, payment_method, status, paid_at,

    description, notes, created_by

  ) VALUES (

    v_tenant_id,

    p_appointment_id,

    v_appointment.patient_id,

    v_appointment.professional_id,

    v_appointment.effective_price,

    v_appointment.effective_price,

    p_amount,

    p_payment_source::public.payment_source,

    p_payment_method,

    CASE WHEN p_amount >= v_appointment.effective_price THEN 'paid' ELSE 'partial' END,

    now(),

    'Pagamento: ' || COALESCE(v_appointment.service_name, 'Procedimento') || ' - ' || COALESCE(v_appointment.client_name, 'Paciente'),

    p_notes,

    v_profile_id

  )

  RETURNING id INTO v_receivable_id;



  -- Criar transa├º├úo financeira (receita)

  INSERT INTO public.financial_transactions (

    tenant_id, appointment_id, type, category, amount, description, transaction_date

  ) VALUES (

    v_tenant_id,

    p_appointment_id,

    'income',

    'Servi├ºo',

    p_amount,

    'Pagamento recebido: ' || COALESCE(v_appointment.service_name, 'Procedimento') || ' - ' || COALESCE(v_appointment.client_name, 'Paciente'),

    v_tx_date

  )

  RETURNING id INTO v_transaction_id;



  RETURN jsonb_build_object(

    'success', true,

    'receivable_id', v_receivable_id,

    'transaction_id', v_transaction_id,

    'amount_paid', p_amount,

    'service_price', v_appointment.effective_price,

    'message', 'Pagamento registrado com sucesso'

  );

END;

$function$;