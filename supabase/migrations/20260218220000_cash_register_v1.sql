-- ============================================================================
-- MILESTONE 2: Caixa (Cash Register) — MVP
-- - Abertura/fechamento de caixa por tenant
-- - Movimentações (sangria/reforço) opcionais
-- - Resumo por método de pagamento baseado em payments (comandas)
-- - Auditoria via audit_logs
-- ============================================================================

-- ─── 1. ENUMS ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cash_movement_type AS ENUM ('reinforcement','withdrawal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status                  public.cash_session_status NOT NULL DEFAULT 'open',

  opened_at               timestamptz NOT NULL DEFAULT now(),
  opened_by               uuid NULL,
  opening_balance         numeric(12,2) NOT NULL DEFAULT 0,
  opening_notes           text NULL,

  closed_at               timestamptz NULL,
  closed_by               uuid NULL,
  closing_balance_reported numeric(12,2) NULL,
  closing_balance_expected numeric(12,2) NULL,
  closing_difference       numeric(12,2) NULL,
  closing_notes            text NULL,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- One open session per tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_sessions_open_per_tenant
  ON public.cash_sessions(tenant_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_created
  ON public.cash_sessions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id    uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type          public.cash_movement_type NOT NULL,
  amount        numeric(12,2) NOT NULL,
  reason        text NULL,
  created_by    uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_movements_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON public.cash_movements(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant
  ON public.cash_movements(tenant_id, created_at DESC);

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_tenant_read" ON public.cash_sessions;
CREATE POLICY "cash_sessions_tenant_read" ON public.cash_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "cash_movements_tenant_read" ON public.cash_movements;
CREATE POLICY "cash_movements_tenant_read" ON public.cash_movements FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Write policies: only via RPC (SECURITY DEFINER) / service_role
DROP POLICY IF EXISTS "cash_sessions_service_write" ON public.cash_sessions;
CREATE POLICY "cash_sessions_service_write" ON public.cash_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_movements_service_write" ON public.cash_movements;
CREATE POLICY "cash_movements_service_write" ON public.cash_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 4. RPCs ────────────────────────────────────────────────────────────────

-- 4a. open_cash_session_v1
CREATE OR REPLACE FUNCTION public.open_cash_session_v1(
  p_opening_balance numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  IF p_opening_balance < 0 THEN
    RAISE EXCEPTION 'Saldo inicial inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE tenant_id = v_profile.tenant_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe um caixa aberto' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.cash_sessions (
    tenant_id, status,
    opened_at, opened_by,
    opening_balance, opening_notes
  ) VALUES (
    v_profile.tenant_id, 'open',
    now(), v_user_id,
    COALESCE(p_opening_balance, 0), p_notes
  )
  RETURNING id INTO v_session_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_session_opened',
    'cash_session',
    v_session_id::text,
    jsonb_build_object('opening_balance', COALESCE(p_opening_balance, 0))
  );

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_cash_session_v1(numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.open_cash_session_v1(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_session_v1(numeric, text) TO service_role;

-- 4b. add_cash_movement_v1 (sangria/reforço)
CREATE OR REPLACE FUNCTION public.add_cash_movement_v1(
  p_type text,
  p_amount numeric,
  p_reason text DEFAULT NULL
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
  v_movement_id uuid;
  v_type public.cash_movement_type;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_type NOT IN ('reinforcement','withdrawal') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_type := p_type::public.cash_movement_type;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE tenant_id = v_profile.tenant_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há caixa aberto' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.cash_movements (
    tenant_id, session_id, type, amount, reason, created_by
  ) VALUES (
    v_profile.tenant_id, v_session.id, v_type, p_amount, p_reason, v_user_id
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_movement_created',
    'cash_movement',
    v_movement_id::text,
    jsonb_build_object('session_id', v_session.id, 'type', p_type, 'amount', p_amount)
  );

  RETURN jsonb_build_object('success', true, 'movement_id', v_movement_id, 'session_id', v_session.id);
END;
$$;

REVOKE ALL ON FUNCTION public.add_cash_movement_v1(text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_cash_movement_v1(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cash_movement_v1(text, numeric, text) TO service_role;

-- 4c. get_cash_session_summary_v1
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
      AND p.paid_at >= v_session.opened_at
      AND p.paid_at <= COALESCE(v_session.closed_at, now())
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

-- 4d. close_cash_session_v1
CREATE OR REPLACE FUNCTION public.close_cash_session_v1(
  p_session_id uuid,
  p_reported_balance numeric,
  p_notes text DEFAULT NULL
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
  v_summary jsonb;
  v_expected numeric;
  v_diff numeric;
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
  WHERE id = p_session_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Caixa já está fechado' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_reported_balance IS NULL OR p_reported_balance < 0 THEN
    RAISE EXCEPTION 'Saldo informado inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Close window first for consistent summary
  UPDATE public.cash_sessions
  SET closed_at = now(), closed_by = v_user_id, updated_at = now()
  WHERE id = v_session.id;

  -- Recalculate session after setting closed_at
  SELECT public.get_cash_session_summary_v1(v_session.id) INTO v_summary;
  v_expected := COALESCE((v_summary->>'expected_closing_balance')::numeric, 0);
  v_diff := p_reported_balance - v_expected;

  UPDATE public.cash_sessions
  SET status = 'closed',
      closing_balance_reported = p_reported_balance,
      closing_balance_expected = v_expected,
      closing_difference = v_diff,
      closing_notes = p_notes,
      updated_at = now()
  WHERE id = v_session.id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_session_closed',
    'cash_session',
    v_session.id::text,
    jsonb_build_object(
      'expected', v_expected,
      'reported', p_reported_balance,
      'difference', v_diff
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', 'closed',
    'expected', v_expected,
    'reported', p_reported_balance,
    'difference', v_diff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_cash_session_v1(uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.close_cash_session_v1(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session_v1(uuid, numeric, text) TO service_role;

-- ─── 5. GRANTS (read-only) ──────────────────────────────────────────────────

GRANT SELECT ON public.cash_sessions TO authenticated;
GRANT SELECT ON public.cash_movements TO authenticated;

GRANT ALL ON public.cash_sessions TO service_role;
GRANT ALL ON public.cash_movements TO service_role;
