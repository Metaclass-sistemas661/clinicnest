-- =====================================================
-- 4.1 Validação de Input: complete_appointment_with_sale
-- Rejeitar p_quantity negativo (valores monetários vêm do appointment)
-- =====================================================

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
  -- Validação: quantity não pode ser negativo (Seção 4.1 diagnóstico)
  IF p_quantity IS NOT NULL AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade de produto não pode ser negativa';
  END IF;

  SELECT a.*, s.name as service_name, s.price as service_price_from_service
  INTO v_appointment
  FROM appointments a
  LEFT JOIN services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  UPDATE appointments SET status = 'completed', updated_at = now() WHERE id = p_appointment_id;
  v_service_price := COALESCE(v_appointment.price, 0);

  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.id, p.user_id, p.full_name INTO v_professional
    FROM profiles p WHERE p.id = v_appointment.professional_id;
    IF v_professional IS NOT NULL THEN v_professional_name := v_professional.full_name; END IF;
  END IF;

  IF v_professional IS NOT NULL AND v_professional.user_id IS NOT NULL THEN
    SELECT pc.id, pc.type, pc.value, pc.payment_type INTO v_commission_config
    FROM professional_commissions pc
    WHERE pc.user_id = v_professional.user_id
      AND pc.tenant_id = v_appointment.tenant_id
      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission')
    LIMIT 1;

    IF v_commission_config IS NOT NULL AND v_commission_config.value > 0 THEN
      IF v_commission_config.type = 'percentage' THEN
        v_commission_amount := (v_service_price * v_commission_config.value) / 100;
      ELSE
        v_commission_amount := v_commission_config.value;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM commission_payments WHERE appointment_id = p_appointment_id) THEN
        INSERT INTO commission_payments (
          tenant_id, professional_id, appointment_id, commission_config_id,
          amount, service_price, commission_type, commission_value, status, notes
        ) VALUES (
          v_appointment.tenant_id, v_professional.user_id, p_appointment_id, v_commission_config.id,
          v_commission_amount, v_service_price, v_commission_config.type, v_commission_config.value,
          'pending', 'Comissão por ' || COALESCE(v_appointment.service_name, 'serviço')
        );
      END IF;
    END IF;
  END IF;

  v_service_profit := v_service_price - COALESCE(v_commission_amount, 0);
  v_total_profit := v_service_profit + v_product_profit;

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

  INSERT INTO public.appointment_completion_summaries (
    tenant_id, appointment_id, professional_name, service_name,
    service_profit, product_sales, product_profit_total, total_profit
  ) VALUES (
    v_appointment.tenant_id, p_appointment_id, v_professional_name,
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_profit, v_product_sales, v_product_profit, v_total_profit
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;
