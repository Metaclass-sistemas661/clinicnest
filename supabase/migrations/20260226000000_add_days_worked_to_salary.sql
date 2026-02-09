-- =====================================================
-- ADICIONAR CAMPOS DE DIAS TRABALHADOS AO SALÁRIO
-- Permite calcular salário proporcional aos dias trabalhados
-- =====================================================

-- 1. Adicionar campos days_worked e days_in_month na tabela salary_payments
DO $$ 
BEGIN
  -- Adicionar days_worked se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'salary_payments' 
    AND column_name = 'days_worked'
  ) THEN
    ALTER TABLE public.salary_payments
    ADD COLUMN days_worked INTEGER CHECK (days_worked IS NULL OR (days_worked >= 1 AND days_worked <= 31));
  END IF;

  -- Adicionar days_in_month se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'salary_payments' 
    AND column_name = 'days_in_month'
  ) THEN
    ALTER TABLE public.salary_payments
    ADD COLUMN days_in_month INTEGER CHECK (days_in_month IS NULL OR (days_in_month >= 28 AND days_in_month <= 31));
  END IF;
END $$;

-- 2. Atualizar RPC pay_salary para aceitar days_worked e calcular proporcionalmente
CREATE OR REPLACE FUNCTION public.pay_salary(
  p_professional_id UUID,
  p_payment_month INTEGER,
  p_payment_year INTEGER,
  p_payment_method TEXT,
  p_days_worked INTEGER DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_commission_config RECORD;
  v_salary_amount NUMERIC;
  v_days_in_month INTEGER;
  v_calculated_amount NUMERIC;
  v_salary_payment_id UUID;
  v_financial_transaction_id UUID;
  v_professional_name TEXT;
BEGIN
  -- Buscar tenant_id e configuração de salário
  SELECT p.tenant_id, p.full_name INTO v_tenant_id, v_professional_name
  FROM profiles p
  WHERE p.user_id = p_professional_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  -- Buscar configuração de salário
  SELECT * INTO v_commission_config
  FROM professional_commissions
  WHERE user_id = p_professional_id
    AND tenant_id = v_tenant_id
    AND payment_type = 'salary'
  LIMIT 1;

  IF v_commission_config IS NULL THEN
    RAISE EXCEPTION 'Profissional não possui salário fixo configurado';
  END IF;

  IF v_commission_config.salary_amount IS NULL OR v_commission_config.salary_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do salário não configurado ou inválido';
  END IF;

  -- Calcular dias do mês
  v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', TO_DATE(p_payment_year || '-' || LPAD(p_payment_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day'));

  -- Calcular valor proporcional se days_worked foi informado
  IF p_days_worked IS NOT NULL AND p_days_worked > 0 THEN
    IF p_days_worked > v_days_in_month THEN
      RAISE EXCEPTION 'Dias trabalhados não pode ser maior que os dias do mês (%)', v_days_in_month;
    END IF;
    v_calculated_amount := (v_commission_config.salary_amount / v_days_in_month) * p_days_worked;
  ELSE
    -- Se não informado, usar o valor completo do salário
    v_calculated_amount := v_commission_config.salary_amount;
    p_days_worked := v_days_in_month;
  END IF;

  -- Verificar se já existe pagamento pago para este período
  IF EXISTS (
    SELECT 1 FROM salary_payments
    WHERE tenant_id = v_tenant_id
      AND professional_id = p_professional_id
      AND payment_month = p_payment_month
      AND payment_year = p_payment_year
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Salário já foi pago para este período';
  END IF;

  -- Criar registro de pagamento de salário
  INSERT INTO salary_payments (
    tenant_id,
    professional_id,
    professional_commission_id,
    payment_month,
    payment_year,
    amount,
    days_worked,
    days_in_month,
    status,
    payment_date,
    payment_method,
    payment_reference,
    paid_by,
    notes
  ) VALUES (
    v_tenant_id,
    p_professional_id,
    v_commission_config.id,
    p_payment_month,
    p_payment_year,
    v_calculated_amount,
    p_days_worked,
    v_days_in_month,
    'paid',
    CURRENT_DATE,
    p_payment_method,
    p_payment_reference,
    auth.uid(),
    p_notes
  )
  RETURNING id INTO v_salary_payment_id;

  -- Criar transação financeira (despesa)
  INSERT INTO financial_transactions (
    tenant_id,
    type,
    category,
    amount,
    description,
    transaction_date,
    salary_payment_id
  ) VALUES (
    v_tenant_id,
    'expense',
    'Funcionários',
    v_calculated_amount,
    'Salário - ' || COALESCE(v_professional_name, 'Profissional') || 
    ' - ' || TO_CHAR(TO_DATE(p_payment_year || '-' || LPAD(p_payment_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD'), 'MM/YYYY') ||
    CASE 
      WHEN p_days_worked IS NOT NULL AND p_days_worked < v_days_in_month 
      THEN ' (' || p_days_worked || '/' || v_days_in_month || ' dias)'
      ELSE ''
    END,
    CURRENT_DATE,
    v_salary_payment_id
  )
  RETURNING id INTO v_financial_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'salary_payment_id', v_salary_payment_id,
    'financial_transaction_id', v_financial_transaction_id,
    'amount', v_calculated_amount,
    'professional_name', v_professional_name,
    'days_worked', p_days_worked,
    'days_in_month', v_days_in_month
  );
END;
$$;

-- 3. Atualizar RPC get_salary_payments para retornar days_worked e days_in_month
CREATE OR REPLACE FUNCTION public.get_salary_payments(
  p_tenant_id UUID,
  p_professional_id UUID DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sp.id,
      'professional_id', sp.professional_id,
      'professional_name', p.full_name,
      'payment_month', sp.payment_month,
      'payment_year', sp.payment_year,
      'amount', sp.amount,
      'days_worked', sp.days_worked,
      'days_in_month', sp.days_in_month,
      'status', sp.status,
      'payment_date', sp.payment_date,
      'payment_method', sp.payment_method,
      'payment_reference', sp.payment_reference,
      'notes', sp.notes,
      'created_at', sp.created_at,
      'updated_at', sp.updated_at
    )
  )
  INTO v_result
  FROM salary_payments sp
  JOIN profiles p ON p.user_id = sp.professional_id
  WHERE sp.tenant_id = p_tenant_id
    AND (p_professional_id IS NULL OR sp.professional_id = p_professional_id)
    AND (p_year IS NULL OR sp.payment_year = p_year)
    AND (p_month IS NULL OR sp.payment_month = p_month)
  ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
