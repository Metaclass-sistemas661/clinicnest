-- ============================================================================
-- FASE 29B: Módulo Financeiro do Paciente (Portal do Paciente)
-- ============================================================================

-- 1) Tabela de faturas do paciente
CREATE TABLE IF NOT EXISTS public.patient_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text,
  payment_gateway text,
  payment_gateway_id text,
  payment_url text,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_invoices_tenant ON public.patient_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_client ON public.patient_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_status ON public.patient_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_due_date ON public.patient_invoices(tenant_id, due_date);

ALTER TABLE public.patient_invoices ENABLE ROW LEVEL SECURITY;

-- RLS: Paciente vê suas faturas
DROP POLICY IF EXISTS "patient_invoices_patient_select" ON public.patient_invoices;
CREATE POLICY "patient_invoices_patient_select" ON public.patient_invoices
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RLS: Admin/staff do tenant gerencia
DROP POLICY IF EXISTS "patient_invoices_tenant_all" ON public.patient_invoices;
CREATE POLICY "patient_invoices_tenant_all" ON public.patient_invoices
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2) Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.patient_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.patient_invoices(id) ON DELETE CASCADE,
  
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  payment_gateway text,
  gateway_transaction_id text,
  
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_payments_tenant ON public.patient_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_payments_invoice ON public.patient_payments(invoice_id);

ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_payments_patient_select" ON public.patient_payments;
CREATE POLICY "patient_payments_patient_select" ON public.patient_payments
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT pi.id FROM public.patient_invoices pi
      JOIN public.patient_profiles pp ON pp.client_id = pi.client_id
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_payments_tenant_all" ON public.patient_payments;
CREATE POLICY "patient_payments_tenant_all" ON public.patient_payments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 3) Configurações de pagamento no tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS patient_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_gateway_type text,
  ADD COLUMN IF NOT EXISTS payment_gateway_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invoice_reminder_days integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.tenants.patient_payment_enabled IS 'Habilita pagamento online no portal do paciente';
COMMENT ON COLUMN public.tenants.payment_gateway_type IS 'Tipo do gateway: stripe, pagseguro, asaas, etc';
COMMENT ON COLUMN public.tenants.payment_gateway_config IS 'Configurações do gateway (chaves, etc)';
COMMENT ON COLUMN public.tenants.invoice_reminder_days IS 'Dias antes do vencimento para enviar lembrete';

-- 4) RPC: Obter resumo financeiro do paciente
CREATE OR REPLACE FUNCTION public.get_patient_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_total_pending numeric;
  v_total_overdue numeric;
  v_next_due_date date;
  v_next_due_amount numeric;
  v_last_payment_date timestamptz;
  v_last_payment_amount numeric;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_linked');
  END IF;

  -- Total pendente
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pending
  FROM public.patient_invoices
  WHERE client_id = v_client_id AND status = 'pending';

  -- Total vencido
  SELECT COALESCE(SUM(amount), 0) INTO v_total_overdue
  FROM public.patient_invoices
  WHERE client_id = v_client_id AND status = 'overdue';

  -- Próximo vencimento
  SELECT due_date, amount INTO v_next_due_date, v_next_due_amount
  FROM public.patient_invoices
  WHERE client_id = v_client_id AND status IN ('pending', 'overdue')
  ORDER BY due_date ASC
  LIMIT 1;

  -- Último pagamento
  SELECT pp.paid_at, pp.amount INTO v_last_payment_date, v_last_payment_amount
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id AND pp.status = 'completed'
  ORDER BY pp.paid_at DESC
  LIMIT 1;

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
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_financial_summary() TO authenticated;

-- 5) RPC: Listar faturas do paciente
CREATE OR REPLACE FUNCTION public.get_patient_invoices(
  p_status text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  description text,
  amount numeric,
  due_date date,
  status text,
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  payment_url text,
  appointment_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  SELECT 
    pi.id,
    pi.description,
    pi.amount,
    pi.due_date,
    pi.status,
    pi.paid_at,
    pi.paid_amount,
    pi.payment_method,
    pi.payment_url,
    pi.appointment_id,
    pi.created_at
  FROM public.patient_invoices pi
  WHERE pi.client_id = v_client_id
    AND (p_status IS NULL OR pi.status = p_status)
    AND (p_from IS NULL OR pi.due_date >= p_from)
    AND (p_to IS NULL OR pi.due_date <= p_to)
  ORDER BY 
    CASE WHEN pi.status IN ('pending', 'overdue') THEN 0 ELSE 1 END,
    pi.due_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_invoices(text, date, date) TO authenticated;

-- 6) RPC: Obter histórico de pagamentos
CREATE OR REPLACE FUNCTION public.get_patient_payment_history(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  invoice_id uuid,
  invoice_description text,
  amount numeric,
  payment_method text,
  status text,
  paid_at timestamptz,
  receipt_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  RETURN QUERY
  SELECT 
    pp.id,
    pp.invoice_id,
    pi.description as invoice_description,
    pp.amount,
    pp.payment_method,
    pp.status,
    pp.paid_at,
    pp.receipt_url
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id
  ORDER BY pp.paid_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_payment_history(integer, integer) TO authenticated;

-- 7) Trigger para atualizar status de faturas vencidas
CREATE OR REPLACE FUNCTION public.update_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending' AND due_date < CURRENT_DATE;
END;
$$;

-- 8) Trigger para atualizar fatura quando pagamento é registrado
CREATE OR REPLACE FUNCTION public.trg_update_invoice_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.patient_invoices
    SET 
      status = 'paid',
      paid_at = NEW.paid_at,
      paid_amount = NEW.amount,
      payment_method = NEW.payment_method,
      updated_at = now()
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_update_invoice ON public.patient_payments;
CREATE TRIGGER trg_payment_update_invoice
  AFTER INSERT ON public.patient_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_invoice_on_payment();
