-- =====================================================
-- 4.1 Validação de Input: pay_salary - rejeitar days_worked negativo
-- Seção 4 do DIAGNOSTICO_COMPLETO.md
-- =====================================================

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
  -- Validação: days_worked não pode ser negativo (Seção 4.1 diagnóstico)
  IF p_days_worked IS NOT NULL AND p_days_worked < 0 THEN
    RAISE EXCEPTION 'Dias trabalhados não pode ser negativo';
  END IF;

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
    v_calculated_amount := v_commission_config.salary_amount;
    p_days_worked := v_days_in_month;
  END IF;

  -- Verificar se já existe pagamento para este período
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
