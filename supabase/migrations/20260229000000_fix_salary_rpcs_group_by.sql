-- =====================================================
-- CORRIGIR ERROS DE GROUP BY NOS RPCs DE SALÁRIO
-- Recria os RPCs garantindo que não haja problemas de GROUP BY
-- =====================================================

-- 1. Remover e recriar get_salary_payments sem problemas de GROUP BY
DROP FUNCTION IF EXISTS public.get_salary_payments(UUID, UUID, INTEGER, INTEGER);

CREATE FUNCTION public.get_salary_payments(
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
  WITH ordered_salaries AS (
    SELECT 
      sp.id,
      sp.professional_id,
      COALESCE(p.full_name, 'Profissional') AS professional_name,
      sp.payment_month,
      sp.payment_year,
      sp.amount,
      sp.days_worked,
      sp.days_in_month,
      sp.status,
      sp.payment_date,
      sp.payment_method,
      sp.payment_reference,
      sp.notes,
      sp.created_at,
      sp.updated_at
    FROM salary_payments sp
    LEFT JOIN profiles p ON p.user_id = sp.professional_id
    WHERE sp.tenant_id = p_tenant_id
      AND (p_professional_id IS NULL OR sp.professional_id = p_professional_id)
      AND (p_year IS NULL OR sp.payment_year = p_year)
      AND (p_month IS NULL OR sp.payment_month = p_month)
    ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'professional_id', professional_id,
      'professional_name', professional_name,
      'payment_month', payment_month,
      'payment_year', payment_year,
      'amount', amount,
      'days_worked', days_worked,
      'days_in_month', days_in_month,
      'status', status,
      'payment_date', payment_date,
      'payment_method', payment_method,
      'payment_reference', payment_reference,
      'notes', notes,
      'created_at', created_at,
      'updated_at', updated_at
    )
  )
  INTO v_result
  FROM ordered_salaries;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 2. Remover e recriar get_professionals_with_salary sem problemas de GROUP BY
DROP FUNCTION IF EXISTS public.get_professionals_with_salary(UUID);

CREATE FUNCTION public.get_professionals_with_salary(
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
  WITH ordered_professionals AS (
    SELECT 
      pc.user_id AS professional_id,
      COALESCE(p.full_name, 'Profissional') AS professional_name,
      pc.salary_amount,
      pc.salary_payment_day,
      pc.default_payment_method,
      pc.id AS commission_id
    FROM professional_commissions pc
    LEFT JOIN profiles p ON p.user_id = pc.user_id
    WHERE pc.tenant_id = p_tenant_id
      AND pc.payment_type = 'salary'
      AND pc.salary_amount IS NOT NULL
      AND pc.salary_amount > 0
    ORDER BY COALESCE(p.full_name, 'Profissional')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'professional_id', professional_id,
      'professional_name', professional_name,
      'salary_amount', salary_amount,
      'salary_payment_day', salary_payment_day,
      'default_payment_method', default_payment_method,
      'commission_id', commission_id
    )
  )
  INTO v_result
  FROM ordered_professionals;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO service_role;
