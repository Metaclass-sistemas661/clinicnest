-- =====================================================
-- CORRIGIR: SALÁRIO FIXO NÃO DEVE CRIAR COMISSÕES
-- Profissionais com payment_type = 'salary' não devem receber comissões ao concluir atendimentos
-- =====================================================

-- 1. Atualizar RPC complete_appointment_with_sale para verificar payment_type antes de criar comissão
CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment RECORD;
  v_service RECORD;
  v_professional RECORD;
  v_commission_config RECORD;
  v_commission_amount NUMERIC := 0;
  v_service_price NUMERIC;
  v_service_profit NUMERIC;
  v_product_profit NUMERIC := 0;
  v_total_profit NUMERIC;
  v_product_sales JSONB := '[]'::jsonb;
  v_professional_name TEXT;
  v_result JSONB;
BEGIN
  -- Buscar agendamento
  SELECT a.*, s.name as service_name, s.price as service_price_from_service
  INTO v_appointment
  FROM appointments a
  LEFT JOIN services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  -- Atualizar status para completed
  UPDATE appointments 
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id;

  -- Preço do serviço
  v_service_price := COALESCE(v_appointment.price, 0);

  -- Buscar profissional
  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.id, p.user_id, p.full_name
    INTO v_professional
    FROM profiles p
    WHERE p.id = v_appointment.professional_id;

    IF v_professional IS NOT NULL THEN
      v_professional_name := v_professional.full_name;
    END IF;
  END IF;

  -- Buscar configuração de comissão do profissional usando user_id
  -- IMPORTANTE: Apenas criar comissão se payment_type = 'commission' ou NULL (compatibilidade)
  IF v_professional IS NOT NULL AND v_professional.user_id IS NOT NULL THEN
    SELECT pc.id, pc.type, pc.value, pc.payment_type
    INTO v_commission_config
    FROM professional_commissions pc
    WHERE pc.user_id = v_professional.user_id
      AND pc.tenant_id = v_appointment.tenant_id
      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission')  -- NÃO criar comissão se payment_type = 'salary'
    LIMIT 1;

    -- Calcular comissão APENAS se payment_type for 'commission' ou NULL
    IF v_commission_config IS NOT NULL AND v_commission_config.value > 0 THEN
      IF v_commission_config.type = 'percentage' THEN
        v_commission_amount := (v_service_price * v_commission_config.value) / 100;
      ELSE
        v_commission_amount := v_commission_config.value;
      END IF;

      -- Criar registro de comissão apenas se ainda não existe para este agendamento
      IF NOT EXISTS (
        SELECT 1 FROM commission_payments 
        WHERE appointment_id = p_appointment_id
      ) THEN
        INSERT INTO commission_payments (
          tenant_id,
          professional_id,
          appointment_id,
          commission_config_id,
          amount,
          service_price,
          commission_type,
          commission_value,
          status,
          notes
        ) VALUES (
          v_appointment.tenant_id,
          v_professional.user_id,
          p_appointment_id,
          v_commission_config.id,
          v_commission_amount,
          v_service_price,
          v_commission_config.type,
          v_commission_config.value,
          'pending',
          'Comissão por ' || COALESCE(v_appointment.service_name, 'serviço')
        );
      END IF;
    END IF;
  END IF;

  -- Calcular lucros
  v_service_profit := v_service_price - COALESCE(v_commission_amount, 0);
  v_total_profit := v_service_profit + v_product_profit;

  -- Retornar dados
  v_result := jsonb_build_object(
    'commission_amount', (COALESCE(v_commission_amount, 0))::float,
    'service_price', v_service_price::float,
    'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
    'professional_name', v_professional_name,
    'service_profit', v_service_profit::float,
    'product_sales', v_product_sales,
    'product_profit_total', v_product_profit::float,
    'total_profit', v_total_profit::float
  );

  -- Inserir em appointment_completion_summaries para acionar popup do admin via Realtime
  INSERT INTO public.appointment_completion_summaries (
    tenant_id,
    appointment_id,
    professional_name,
    service_name,
    service_profit,
    product_sales,
    product_profit_total,
    total_profit
  ) VALUES (
    v_appointment.tenant_id,
    p_appointment_id,
    v_professional_name,
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_profit,
    v_product_sales,
    v_product_profit,
    v_total_profit
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;

-- 2. Atualizar RPC get_dashboard_commission_totals para filtrar apenas comissões (não salários)
CREATE OR REPLACE FUNCTION public.get_dashboard_commission_totals(
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
BEGIN
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';

  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  -- Staff só pode ver próprias comissões
  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != auth.uid() THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  IF p_is_admin THEN
    -- Admin: soma de todas as comissões do tenant
    -- FILTRAR: apenas comissões de profissionais com payment_type = 'commission' ou NULL
    SELECT 
      COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM commission_payments cp
    LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id
    WHERE cp.tenant_id = p_tenant_id
      AND cp.created_at >= v_month_start
      AND cp.created_at <= v_month_end
      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir salários
  ELSE
    -- Staff: apenas suas comissões
    IF p_professional_user_id IS NOT NULL THEN
      SELECT 
        COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)
      INTO v_pending, v_paid
      FROM commission_payments cp
      LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id
      WHERE cp.tenant_id = p_tenant_id
        AND cp.professional_id = p_professional_user_id
        AND cp.created_at >= v_month_start
        AND cp.created_at <= v_month_end
        AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir salários
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pending', (v_pending)::float,
    'paid', (v_paid)::float
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_commission_totals(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_commission_totals(uuid, boolean, uuid) TO service_role;
