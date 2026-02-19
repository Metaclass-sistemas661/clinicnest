-- Patch: saldo do caixa considerar paid_at nulo (fallback para created_at)
-- Motivo: em alguns fluxos legados, payments.status='paid' mas paid_at pode estar nulo,
-- e o resumo do caixa ignora esses pagamentos, deixando o "Saldo do Dia" sem somar entradas.

CREATE OR REPLACE FUNCTION public.get_cash_session_summary_v1(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_payments jsonb;
  v_withdrawals numeric := 0;
  v_reinforcements numeric := 0;
  v_total numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals
  FROM public.cash_movements
  WHERE session_id = v_session.id AND type = 'withdrawal';

  SELECT COALESCE(SUM(amount), 0) INTO v_reinforcements
  FROM public.cash_movements
  WHERE session_id = v_session.id AND type = 'reinforcement';

  -- Summary by payment method for payments in the session window
  -- Fallback importante: se paid_at for nulo (legado), usar created_at.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'payment_method_id', pm.id,
        'code', pm.code,
        'name', pm.name,
        'amount', x.amount
      )
      ORDER BY pm.sort_order
    ),
    '[]'::jsonb
  ) INTO v_payments
  FROM (
    SELECT p.payment_method_id, SUM(p.amount)::numeric AS amount
    FROM public.payments p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.tenant_id = v_session.tenant_id
      AND p.status = 'paid'
      AND COALESCE(p.paid_at, p.created_at) >= v_session.opened_at
      AND COALESCE(p.paid_at, p.created_at) <= COALESCE(v_session.closed_at, now())
    GROUP BY p.payment_method_id
  ) x
  JOIN public.payment_methods pm ON pm.id = x.payment_method_id;

  -- Expected total (cashbox perspective): opening + reinforcements - withdrawals + sum(payments)
  SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_total
  FROM jsonb_array_elements(v_payments) elem;

  v_total := COALESCE(v_session.opening_balance, 0) + v_reinforcements - v_withdrawals + v_total;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', v_session.status,
    'opened_at', v_session.opened_at,
    'closed_at', v_session.closed_at,
    'opening_balance', v_session.opening_balance,
    'reinforcements', v_reinforcements,
    'withdrawals', v_withdrawals,
    'payments', v_payments,
    'expected_closing_balance', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cash_session_summary_v1(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cash_session_summary_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_session_summary_v1(uuid) TO service_role;
