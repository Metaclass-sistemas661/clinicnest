-- =====================================================
-- ADICIONAR RPCs PARA DASHBOARD: PERDAS DE PRODUTOS E CLIENTES
-- Criar RPCs similares aos de comissões e salários para garantir consistência
-- =====================================================

-- 1. RPC para calcular total de perdas de produtos (baixas danificadas) do mês
CREATE OR REPLACE FUNCTION public.get_dashboard_product_loss_total(
  p_tenant_id UUID,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_loss NUMERIC := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_current_month INTEGER;
  v_current_year INTEGER;
BEGIN
  -- Se não especificado, usar mês atual
  IF p_year IS NULL OR p_month IS NULL THEN
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    v_month_start := date_trunc('month', CURRENT_DATE);
    v_month_end := date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 second';
  ELSE
    v_current_month := p_month;
    v_current_year := p_year;
    v_month_start := date_trunc('month', make_date(p_year, p_month, 1));
    v_month_end := date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month' - interval '1 second';
  END IF;

  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN 0;
  END IF;

  -- Calcular total de perdas: SUM(ABS(quantity) * cost) para movimentos danificados do mês
  SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(p.cost, 0)), 0)
  INTO v_total_loss
  FROM stock_movements sm
  LEFT JOIN products p ON p.id = sm.product_id
  WHERE sm.tenant_id = p_tenant_id
    AND sm.movement_type = 'out'
    AND sm.out_reason_type = 'damaged'
    AND sm.created_at >= v_month_start
    AND sm.created_at <= v_month_end;

  RETURN v_total_loss;
END;
$$;

-- 2. RPC para contar total de clientes do tenant
CREATE OR REPLACE FUNCTION public.get_dashboard_clients_count(
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN 0;
  END IF;

  -- Contar clientes únicos do tenant (garantir filtro correto)
  SELECT COUNT(id)
  INTO v_count
  FROM clients
  WHERE tenant_id = p_tenant_id;

  RETURN COALESCE(v_count, 0)::INTEGER;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_dashboard_product_loss_total(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_product_loss_total(UUID, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_dashboard_clients_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_clients_count(UUID) TO service_role;
