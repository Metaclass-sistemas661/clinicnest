-- =====================================================
-- CORRIGIR RPCs DE SALÁRIO E ADICIONAR RPC PARA DASHBOARD
-- Corrige erros de GROUP BY e adiciona RPC similar ao de comissões
-- =====================================================

-- 1. Recriar RPC get_salary_payments sem problemas de GROUP BY
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
      'professional_name', COALESCE(p.full_name, 'Profissional'),
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
  LEFT JOIN profiles p ON p.user_id = sp.professional_id
  WHERE sp.tenant_id = p_tenant_id
    AND (p_professional_id IS NULL OR sp.professional_id = p_professional_id)
    AND (p_year IS NULL OR sp.payment_year = p_year)
    AND (p_month IS NULL OR sp.payment_month = p_month)
  ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 2. Recriar RPC get_professionals_with_salary sem problemas de GROUP BY
CREATE OR REPLACE FUNCTION public.get_professionals_with_salary(
  p_tenant_id UUID
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
      'professional_id', pc.user_id,
      'professional_name', COALESCE(p.full_name, 'Profissional'),
      'salary_amount', pc.salary_amount,
      'salary_payment_day', pc.salary_payment_day,
      'default_payment_method', pc.default_payment_method,
      'commission_id', pc.id
    )
  )
  INTO v_result
  FROM professional_commissions pc
  LEFT JOIN profiles p ON p.user_id = pc.user_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.payment_type = 'salary'
    AND pc.salary_amount IS NOT NULL
    AND pc.salary_amount > 0
  ORDER BY COALESCE(p.full_name, 'Profissional');

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Criar RPC para calcular totais de salários do Dashboard (similar ao get_dashboard_commission_totals)
CREATE OR REPLACE FUNCTION public.get_dashboard_salary_totals(
  p_tenant_id UUID,
  p_is_admin BOOLEAN,
  p_professional_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_current_month INTEGER;
  v_current_year INTEGER;
BEGIN
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  -- Staff só pode ver próprios salários
  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != auth.uid() THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  IF p_is_admin THEN
    -- Admin: calcular salários a pagar (profissionais com salário configurado que ainda não foram pagos no mês)
    -- Primeiro, buscar profissionais com salário configurado
    SELECT COALESCE(SUM(pc.salary_amount), 0)
    INTO v_pending
    FROM professional_commissions pc
    WHERE pc.tenant_id = p_tenant_id
      AND pc.payment_type = 'salary'
      AND pc.salary_amount IS NOT NULL
      AND pc.salary_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM salary_payments sp
        WHERE sp.tenant_id = p_tenant_id
          AND sp.professional_id = pc.user_id
          AND sp.payment_year = v_current_year
          AND sp.payment_month = v_current_month
          AND sp.status = 'paid'
      );

    -- Admin: calcular salários pagos no mês
    SELECT COALESCE(SUM(sp.amount), 0)
    INTO v_paid
    FROM salary_payments sp
    WHERE sp.tenant_id = p_tenant_id
      AND sp.payment_year = v_current_year
      AND sp.payment_month = v_current_month
      AND sp.status = 'paid';
  ELSE
    -- Staff: apenas seus próprios salários
    IF p_professional_user_id IS NOT NULL THEN
      -- Staff: verificar se tem salário configurado e não foi pago
      SELECT COALESCE(SUM(pc.salary_amount), 0)
      INTO v_pending
      FROM professional_commissions pc
      WHERE pc.tenant_id = p_tenant_id
        AND pc.user_id = p_professional_user_id
        AND pc.payment_type = 'salary'
        AND pc.salary_amount IS NOT NULL
        AND pc.salary_amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM salary_payments sp
          WHERE sp.tenant_id = p_tenant_id
            AND sp.professional_id = p_professional_user_id
            AND sp.payment_year = v_current_year
            AND sp.payment_month = v_current_month
            AND sp.status = 'paid'
        );

      -- Staff: calcular salários pagos no mês
      SELECT COALESCE(SUM(sp.amount), 0)
      INTO v_paid
      FROM salary_payments sp
      WHERE sp.tenant_id = p_tenant_id
        AND sp.professional_id = p_professional_user_id
        AND sp.payment_year = v_current_year
        AND sp.payment_month = v_current_month
        AND sp.status = 'paid';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pending', (v_pending)::float,
    'paid', (v_paid)::float
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_salary_totals(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_salary_totals(UUID, BOOLEAN, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO service_role;
