-- P1: Add audit logs to existing critical RPCs for enterprise traceability

-- cancel_appointment: add audit
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt public.appointments%rowtype;
  v_is_admin boolean;
  v_already_cancelled boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('cancel_appointment'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido cancelar um agendamento concluído';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este agendamento';
  END IF;

  IF v_apt.status = 'cancelled' THEN
    v_already_cancelled := true;
  ELSE
    UPDATE public.appointments
      SET status = 'cancelled',
          updated_at = now(),
          notes = CASE
            WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN notes
            ELSE COALESCE(notes, '') || '\nCancelamento: ' || p_reason
          END
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_cancelled',
    'appointment',
    v_apt.id::text,
    jsonb_build_object(
      'already_cancelled', v_already_cancelled,
      'reason', NULLIF(p_reason, ''),
      'was_admin', v_is_admin
    )
  );

  RETURN jsonb_build_object('success', true, 'already_cancelled', v_already_cancelled, 'appointment_id', v_apt.id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO service_role;


-- adjust_stock: add audit
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_out_reason_type text default null,
  p_reason text default null,
  p_purchased_with_company_cash boolean default false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_signed_qty integer;
  v_new_qty integer;
  v_amount numeric;
  v_tx_id uuid;
  v_movement_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  IF p_movement_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'movement_type inválido';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    RAISE EXCEPTION 'Apenas admin pode ajustar estoque';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text), hashtext('adjust_stock'));

  SELECT * INTO v_product
  FROM public.products pr
  WHERE pr.id = p_product_id
    AND pr.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_signed_qty := CASE WHEN p_movement_type = 'in' THEN p_quantity ELSE -p_quantity END;
  v_new_qty := v_product.quantity + v_signed_qty;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  INSERT INTO public.stock_movements (
    tenant_id,
    product_id,
    quantity,
    movement_type,
    out_reason_type,
    reason,
    created_by
  ) VALUES (
    v_profile.tenant_id,
    v_product.id,
    v_signed_qty,
    p_movement_type,
    CASE WHEN p_movement_type = 'out' THEN NULLIF(p_out_reason_type, '') ELSE NULL END,
    p_reason,
    v_profile.id
  ) RETURNING id INTO v_movement_id;

  UPDATE public.products
    SET quantity = v_new_qty,
        updated_at = now()
  WHERE id = v_product.id
    AND tenant_id = v_profile.tenant_id;

  IF p_movement_type = 'in' AND p_purchased_with_company_cash IS TRUE THEN
    v_amount := COALESCE(v_product.cost, 0) * p_quantity;
    INSERT INTO public.financial_transactions (
      tenant_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      product_id
    ) VALUES (
      v_profile.tenant_id,
      'expense',
      'Produtos',
      v_amount,
      'Compra de produto (entrada de estoque) - ' || COALESCE(v_product.name, 'Produto'),
      current_date,
      v_product.id
    ) RETURNING id INTO v_tx_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'stock_adjusted',
    'product',
    v_product.id::text,
    jsonb_build_object(
      'movement_id', v_movement_id::text,
      'movement_type', p_movement_type,
      'quantity', p_quantity,
      'signed_quantity', v_signed_qty,
      'new_quantity', v_new_qty,
      'out_reason_type', NULLIF(p_out_reason_type, ''),
      'reason', NULLIF(p_reason, ''),
      'purchased_with_company_cash', p_purchased_with_company_cash,
      'financial_transaction_id', CASE WHEN v_tx_id IS NULL THEN NULL ELSE v_tx_id::text END
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product.id,
    'movement_id', v_movement_id,
    'financial_transaction_id', v_tx_id,
    'new_quantity', v_new_qty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock(uuid, text, integer, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, text, integer, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, text, integer, text, text, boolean) TO service_role;


-- mark_commission_paid: add audit
CREATE OR REPLACE FUNCTION public.mark_commission_paid(
  p_commission_payment_id uuid,
  p_payment_date date default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.commission_payments%rowtype;
  v_paid boolean;
  v_payment_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_payment_date := COALESCE(p_payment_date, current_date);

  PERFORM pg_advisory_xact_lock(hashtext(p_commission_payment_id::text), hashtext('mark_commission_paid'));

  SELECT * INTO v_row
  FROM public.commission_payments cp
  WHERE cp.id = p_commission_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada';
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_row.tenant_id) THEN
    RAISE EXCEPTION 'Apenas admin pode pagar comissão';
  END IF;

  v_paid := (v_row.status = 'paid');
  IF v_paid THEN
    PERFORM public.log_tenant_action(
      v_row.tenant_id,
      v_user_id,
      'commission_marked_paid',
      'commission_payment',
      v_row.id::text,
      jsonb_build_object('already_paid', true)
    );

    RETURN jsonb_build_object('success', true, 'already_paid', true, 'commission_payment_id', v_row.id);
  END IF;

  IF v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'Comissão cancelada não pode ser paga';
  END IF;

  UPDATE public.commission_payments
    SET status = 'paid',
        payment_date = v_payment_date,
        paid_by = v_user_id,
        updated_at = now()
  WHERE id = v_row.id;

  PERFORM public.log_tenant_action(
    v_row.tenant_id,
    v_user_id,
    'commission_marked_paid',
    'commission_payment',
    v_row.id::text,
    jsonb_build_object('already_paid', false, 'payment_date', v_payment_date)
  );

  RETURN jsonb_build_object('success', true, 'already_paid', false, 'commission_payment_id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_commission_paid(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_commission_paid(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_commission_paid(uuid, date) TO service_role;
