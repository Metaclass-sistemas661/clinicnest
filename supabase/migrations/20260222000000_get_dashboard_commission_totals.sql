-- RPC para buscar totais de comissões do Dashboard (admin e staff).
-- Executa no servidor, evita problemas de RLS/filtro no cliente.

CREATE OR REPLACE FUNCTION public.get_dashboard_commission_totals(
  p_tenant_id UUID,
  p_is_admin BOOLEAN,
  p_professional_user_id UUID DEFAULT NULL  -- para staff: profiles.user_id (auth id)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending DECIMAL(15,2) := 0;
  v_paid DECIMAL(15,2) := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  v_month_start := date_trunc('month', CURRENT_DATE)::timestamptz;
  v_month_end := date_trunc('month', CURRENT_DATE) + interval '1 month';

  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('pending', 0, 'paid', 0);
  END IF;

  -- Staff só pode ver próprias comissões
  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != auth.uid() THEN
    RETURN jsonb_build_object('pending', 0, 'paid', 0);
  END IF;

  IF p_is_admin THEN
    SELECT
      COALESCE(SUM(CASE WHEN LOWER(cp.status::text) = 'pending' THEN cp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN LOWER(cp.status::text) = 'paid' THEN cp.amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM public.commission_payments cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.created_at >= v_month_start
      AND cp.created_at < v_month_end
      AND LOWER(cp.status::text) IN ('pending', 'paid');
  ELSIF p_professional_user_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN LOWER(cp.status::text) = 'pending' THEN cp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN LOWER(cp.status::text) = 'paid' THEN cp.amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM public.commission_payments cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.professional_id = p_professional_user_id
      AND cp.created_at >= v_month_start
      AND cp.created_at < v_month_end
      AND LOWER(cp.status::text) IN ('pending', 'paid');
  END IF;

  RETURN jsonb_build_object(
    'pending', (v_pending)::float,
    'paid', (v_paid)::float
  );
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_commission_totals IS 'Retorna totais de comissões pendentes e pagas do mês atual para Dashboard (admin ou staff).';

-- Permitir que usuários autenticados do tenant chamem
GRANT EXECUTE ON FUNCTION public.get_dashboard_commission_totals(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_commission_totals(UUID, BOOLEAN, UUID) TO service_role;
