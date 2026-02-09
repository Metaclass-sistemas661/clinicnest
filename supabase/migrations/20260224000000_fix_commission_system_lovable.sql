-- =====================================================
-- CORREÇÃO DO SISTEMA DE COMISSÕES (baseado no Lovable)
-- Atualiza políticas RLS e RPCs sem recriar tabelas
-- =====================================================

-- 0. Garantir política RLS de INSERT para appointment_completion_summaries
-- Necessário para que o RPC SECURITY DEFINER possa inserir quando staff conclui agendamento
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Sistema pode inserir completion summaries" ON public.appointment_completion_summaries;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Sistema pode inserir completion summaries"
  ON public.appointment_completion_summaries FOR INSERT
  WITH CHECK (true);  -- RPC SECURITY DEFINER precisa poder inserir

-- 1. Garantir que a tabela commission_payments existe (não recriar se já existir)
-- A tabela já existe com a estrutura correta, então apenas verificamos índices

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_commission_payments_tenant ON public.commission_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_professional ON public.commission_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON public.commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_created ON public.commission_payments(created_at);

-- Garantir trigger updated_at existe
DROP TRIGGER IF EXISTS update_commission_payments_updated_at ON public.commission_payments;
CREATE TRIGGER update_commission_payments_updated_at
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Atualizar políticas RLS para commission_payments
-- Remover políticas antigas
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Staff can view own commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can create commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can update commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can delete commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Profissionais podem ver suas próprias comissões" ON public.commission_payments;
  DROP POLICY IF EXISTS "Sistema e admins podem criar pagamentos de comissão" ON public.commission_payments;
  DROP POLICY IF EXISTS "Apenas admins podem atualizar pagamentos" ON public.commission_payments;
  DROP POLICY IF EXISTS "Apenas admins podem deletar pagamentos" ON public.commission_payments;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- SELECT: Staff vê apenas suas próprias comissões, admins veem todas do tenant
CREATE POLICY "Staff can view own commissions"
  ON public.commission_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.tenant_id = commission_payments.tenant_id
    )
    AND (
      professional_id = auth.uid()  -- Staff vê suas próprias
      OR is_tenant_admin(auth.uid(), tenant_id)  -- Admin vê todas do tenant
    )
  );

-- INSERT: Staff pode criar sua própria comissão (quando completa agendamento), admins podem criar qualquer
CREATE POLICY "Admins can create commissions"
  ON public.commission_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.tenant_id = commission_payments.tenant_id
    )
    AND (
      professional_id = auth.uid()  -- Staff pode criar para si mesmo
      OR is_tenant_admin(auth.uid(), tenant_id)  -- Admin pode criar para qualquer um
    )
  );

-- UPDATE: Apenas admins podem atualizar (pagar comissões)
CREATE POLICY "Admins can update commissions"
  ON public.commission_payments FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- DELETE: Apenas admins podem deletar
CREATE POLICY "Admins can delete commissions"
  ON public.commission_payments FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- 3. Atualizar RPC: complete_appointment_with_sale
-- Versão completa com cálculo de lucros e INSERT em appointment_completion_summaries para popup do admin
DROP FUNCTION IF EXISTS public.complete_appointment_with_sale(uuid, uuid, integer);

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
  v_product RECORD;
  v_commission_config RECORD;
  v_commission_amount NUMERIC := 0;
  v_result JSONB;
  v_professional_user_id UUID;
  v_professional_name TEXT := '';
  -- Variáveis para produtos e lucros
  v_product_revenue NUMERIC := 0;
  v_product_cost NUMERIC := 0;
  v_product_profit NUMERIC := 0;
  v_product_sales JSONB := '[]'::jsonb;
  v_service_profit NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_service_price NUMERIC := 0;
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

  v_service_price := COALESCE(v_appointment.price, 0);

  -- Venda de produto (se houver)
  IF p_product_id IS NOT NULL AND p_quantity IS NOT NULL AND p_quantity > 0 THEN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND tenant_id = v_appointment.tenant_id;
    IF v_product IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    IF v_product.quantity < p_quantity THEN RAISE EXCEPTION 'Estoque insuficiente para o produto selecionado.'; END IF;
    
    v_product_revenue := COALESCE(v_product.sale_price, v_product.cost, 0) * p_quantity;
    v_product_cost := COALESCE(v_product.cost, 0) * p_quantity;
    v_product_profit := v_product_revenue - v_product_cost;
    
    v_product_sales := jsonb_build_array(jsonb_build_object(
      'product_name', v_product.name,
      'quantity', p_quantity,
      'revenue', (v_product_revenue)::float,
      'cost', (v_product_cost)::float,
      'profit', (v_product_profit)::float
    ));
    
    -- Registrar movimentação de estoque
    INSERT INTO public.stock_movements (tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by)
    VALUES (
      v_appointment.tenant_id,
      p_product_id,
      -p_quantity,
      'out',
      'sale',
      COALESCE('Venda durante o serviço ' || v_appointment.service_name, 'Venda durante atendimento'),
      (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    );
    
    -- Atualizar estoque
    UPDATE public.products SET quantity = quantity - p_quantity WHERE id = p_product_id;
    
    -- Registrar transação financeira
    INSERT INTO public.financial_transactions (
      tenant_id, type, category, amount, description, transaction_date, product_id, appointment_id
    ) VALUES (
      v_appointment.tenant_id,
      'income',
      'Venda de Produto',
      v_product_revenue,
      'Venda de ' || v_product.name || ' (' || p_quantity || ' un.)' || 
        COALESCE(' · Serviço: ' || v_appointment.service_name, ''),
      CURRENT_DATE,
      p_product_id,
      p_appointment_id
    );
  END IF;

  -- Atualizar status para completed
  UPDATE appointments 
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id;

  -- Buscar profissional e seu user_id (apenas se professional_id não for NULL)
  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.id, p.user_id, p.full_name
    INTO v_professional
    FROM profiles p
    WHERE p.id = v_appointment.professional_id;

    IF v_professional IS NOT NULL AND v_professional.full_name IS NOT NULL THEN
      v_professional_name := v_professional.full_name;
    END IF;
  END IF;

  -- Buscar configuração de comissão do profissional usando user_id
  IF v_professional IS NOT NULL AND v_professional.user_id IS NOT NULL THEN
    SELECT pc.id, pc.type, pc.value
    INTO v_commission_config
    FROM professional_commissions pc
    WHERE pc.user_id = v_professional.user_id
      AND pc.tenant_id = v_appointment.tenant_id
    LIMIT 1;

    -- Calcular comissão
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

-- 4. Atualizar RPC: get_dashboard_commission_totals
DROP FUNCTION IF EXISTS public.get_dashboard_commission_totals(uuid, boolean, uuid);

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
    SELECT 
      COALESCE(SUM(CASE WHEN status::text = 'pending' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status::text = 'paid' THEN amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM commission_payments
    WHERE tenant_id = p_tenant_id
      AND created_at >= v_month_start
      AND created_at <= v_month_end;
  ELSE
    -- Staff: apenas suas comissões
    IF p_professional_user_id IS NOT NULL THEN
      SELECT 
        COALESCE(SUM(CASE WHEN status::text = 'pending' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status::text = 'paid' THEN amount ELSE 0 END), 0)
      INTO v_pending, v_paid
      FROM commission_payments
      WHERE tenant_id = p_tenant_id
        AND professional_id = p_professional_user_id
        AND created_at >= v_month_start
        AND created_at <= v_month_end;
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
