-- ============================================================================
-- FASE 40: Refatoração do Sistema Financeiro
-- ============================================================================
-- Problema: O sistema gera receita e comissão automaticamente ao concluir
-- agendamento (lógica de salão de beleza). Em clínicas, receita só deve ser
-- gerada quando o pagamento é efetivamente recebido.
--
-- Mudanças:
-- 1. Desativa trigger de comissão automática
-- 2. Cria tabela accounts_receivable para vincular atendimentos a pagamentos
-- 3. Refatora complete_appointment_with_sale para NÃO gerar income/commission
-- 4. Cria RPCs para registro de pagamento e cálculo de comissão
-- ============================================================================

-- ============================================================================
-- PARTE 1: Desativar triggers automáticos de comissão
-- ============================================================================

-- Desativa o trigger que gera comissão automaticamente ao concluir agendamento
DROP TRIGGER IF EXISTS trigger_calculate_commission_on_completed ON public.appointments;

-- Mantém a função para referência histórica, mas ela não será mais chamada
COMMENT ON FUNCTION public.calculate_commission_on_appointment_completed() IS 
  'DEPRECATED (Fase 40): Esta função não é mais usada. Comissões agora são calculadas sobre recebimentos, não atendimentos.';

-- ============================================================================
-- PARTE 2: Criar tabela accounts_receivable
-- ============================================================================

-- Enum para status de conta a receber de atendimento
DO $$ BEGIN
    CREATE TYPE public.receivable_status AS ENUM ('pending', 'partial', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de pagamento
DO $$ BEGIN
    CREATE TYPE public.payment_source AS ENUM ('particular', 'insurance', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de contas a receber vinculadas a atendimentos
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Vínculo com atendimento (obrigatório para receitas de serviço)
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Vínculo com guia TISS (para convênios)
    tiss_guide_id UUID,
    
    -- Valores
    service_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    
    -- Informações do pagamento
    payment_source public.payment_source NOT NULL DEFAULT 'particular',
    payment_method TEXT,
    installments INTEGER DEFAULT 1,
    
    -- Status e datas
    status public.receivable_status NOT NULL DEFAULT 'pending',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    
    -- Descrição
    description TEXT,
    notes TEXT,
    
    -- Auditoria
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_tenant ON public.accounts_receivable(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_appointment ON public.accounts_receivable(appointment_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_client ON public.accounts_receivable(client_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_professional ON public.accounts_receivable(professional_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON public.accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due_date ON public.accounts_receivable(due_date);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_accounts_receivable_updated_at ON public.accounts_receivable;
CREATE TRIGGER update_accounts_receivable_updated_at
    BEFORE UPDATE ON public.accounts_receivable
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Tenant members can view accounts_receivable" ON public.accounts_receivable;
CREATE POLICY "Tenant members can view accounts_receivable"
    ON public.accounts_receivable FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.tenant_id = accounts_receivable.tenant_id
        )
    );

DROP POLICY IF EXISTS "Admins can manage accounts_receivable" ON public.accounts_receivable;
CREATE POLICY "Admins can manage accounts_receivable"
    ON public.accounts_receivable FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = accounts_receivable.tenant_id
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = accounts_receivable.tenant_id
            AND ur.role = 'admin'
        )
    );

-- ============================================================================
-- PARTE 3: Refatorar complete_appointment_with_sale
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_requester_profile_id UUID;
  v_requester_is_admin BOOLEAN := FALSE;
  v_tenant_id UUID;
  v_appointment RECORD;
  v_product RECORD;
  v_professional_user_id UUID;
  v_professional_name TEXT;
  v_service_price NUMERIC := 0;
  v_product_revenue NUMERIC := 0;
  v_product_cost NUMERIC := 0;
  v_product_profit NUMERIC := 0;
  v_product_sales JSONB := '[]'::jsonb;
  v_description TEXT;
  v_already_completed BOOLEAN := FALSE;
  v_tx_date DATE;
BEGIN
  -- Validações básicas
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NOT NULL AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade de produto não pode ser negativa';
  END IF;

  IF p_product_id IS NOT NULL AND (p_quantity IS NULL OR p_quantity <= 0) THEN
    RAISE EXCEPTION 'Quantidade de produto deve ser maior que zero quando houver produto';
  END IF;

  -- Lock para evitar concorrência
  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('complete_appointment_with_sale'));

  -- Buscar agendamento
  SELECT
    a.*,
    s.name AS service_name,
    c.name AS client_name,
    COALESCE(a.price, s.price, 0)::numeric AS effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id
  FOR UPDATE OF a;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  v_tenant_id := v_appointment.tenant_id;

  -- Verificar permissões
  SELECT p.id
  INTO v_requester_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_requester_user_id
    AND p.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_requester_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado no tenant do agendamento';
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, v_tenant_id);

  IF NOT v_requester_is_admin
     AND v_appointment.professional_id IS DISTINCT FROM v_requester_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para concluir este agendamento';
  END IF;

  v_already_completed := (v_appointment.status = 'completed');

  -- Buscar dados do profissional
  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name
    INTO v_professional_user_id, v_professional_name
    FROM public.profiles p
    WHERE p.id = v_appointment.professional_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  -- Se já estava concluído, retornar dados existentes
  IF v_already_completed THEN
    v_service_price := COALESCE(v_appointment.effective_price, 0);

    SELECT s.product_sales, s.product_profit_total
    INTO v_product_sales, v_product_profit
    FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'already_completed', true,
      'service_price', (v_service_price)::float,
      'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
      'professional_name', COALESCE(v_professional_name, ''),
      'product_sales', COALESCE(v_product_sales, '[]'::jsonb),
      'product_profit_total', (COALESCE(v_product_profit, 0))::float,
      'message', 'Atendimento já estava concluído. Use "Registrar Pagamento" para gerar receita.'
    );
  END IF;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_service_price := COALESCE(v_appointment.effective_price, 0);

  -- =========================================================================
  -- MUDANÇA FASE 40: NÃO gerar financial_transaction de income automaticamente
  -- A receita será gerada apenas quando o pagamento for registrado
  -- =========================================================================

  -- Processar venda de produto (se houver)
  IF p_product_id IS NOT NULL THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND tenant_id = v_tenant_id
    LIMIT 1;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;

    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto selecionado.';
    END IF;

    v_product_revenue := COALESCE(v_product.sale_price, v_product.cost, 0) * p_quantity;
    v_product_cost := COALESCE(v_product.cost, 0) * p_quantity;
    v_product_profit := v_product_revenue - v_product_cost;

    v_product_sales := jsonb_build_array(
      jsonb_build_object(
        'product_name', v_product.name,
        'quantity', p_quantity,
        'revenue', (v_product_revenue)::float,
        'cost', (v_product_cost)::float,
        'profit', (v_product_profit)::float
      )
    );

    -- Registrar saída de estoque
    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_tenant_id, p_product_id, -p_quantity, 'out', 'sale',
      COALESCE('Venda durante o serviço ' || v_appointment.service_name, 'Venda durante atendimento'),
      v_requester_profile_id
    );

    UPDATE public.products
    SET quantity = quantity - p_quantity
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    -- Receita de produto é registrada imediatamente (venda à vista)
    v_description := 'Venda de ' || v_product.name || ' (' || p_quantity || ' un.)';
    IF v_appointment.service_name IS NOT NULL THEN
      v_description := v_description || ' · Serviço: ' || v_appointment.service_name;
    END IF;
    IF v_appointment.client_name IS NOT NULL THEN
      v_description := v_description || ' · Cliente: ' || v_appointment.client_name;
    END IF;

    INSERT INTO public.financial_transactions (
      tenant_id, type, category, amount, description, transaction_date, product_id, appointment_id
    )
    SELECT v_tenant_id, 'income', 'Venda de Produto', v_product_revenue, v_description, v_tx_date, p_product_id, p_appointment_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.appointment_id = p_appointment_id
        AND ft.product_id = p_product_id
        AND ft.type = 'income'
        AND ft.category = 'Venda de Produto'
    );
  END IF;

  -- Atualizar status do agendamento
  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id
    AND status <> 'completed';

  -- =========================================================================
  -- MUDANÇA FASE 40: NÃO gerar commission_payments automaticamente
  -- Comissões serão calculadas sobre recebimentos, não atendimentos
  -- =========================================================================

  -- Criar registro de resumo (sem comissão)
  INSERT INTO public.appointment_completion_summaries (
    tenant_id, appointment_id, professional_name, service_name,
    service_profit, product_sales, product_profit_total, total_profit
  )
  SELECT
    v_tenant_id, p_appointment_id,
    COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_price, -- Lucro do serviço = preço (sem deduzir comissão ainda)
    v_product_sales,
    v_product_profit,
    v_service_price + v_product_profit
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
  );

  RETURN jsonb_build_object(
    'already_completed', false,
    'service_price', (v_service_price)::float,
    'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
    'professional_name', COALESCE(v_professional_name, ''),
    'product_sales', v_product_sales,
    'product_profit_total', (v_product_profit)::float,
    'total_value', (v_service_price + v_product_revenue)::float,
    'message', 'Atendimento concluído. Registre o pagamento para gerar a receita.',
    'requires_payment', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;

-- ============================================================================
-- PARTE 4: RPC para registrar pagamento de atendimento
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_appointment_payment(
  p_appointment_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'Dinheiro',
  p_payment_source TEXT DEFAULT 'particular',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_tenant_id UUID;
  v_appointment RECORD;
  v_receivable_id UUID;
  v_transaction_id UUID;
  v_tx_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero';
  END IF;

  -- Buscar agendamento
  SELECT
    a.*,
    s.name AS service_name,
    c.name AS client_name,
    COALESCE(a.price, s.price, 0)::numeric AS effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status <> 'completed' THEN
    RAISE EXCEPTION 'Agendamento deve estar concluído para registrar pagamento';
  END IF;

  v_tenant_id := v_appointment.tenant_id;

  -- Verificar permissões (admin do tenant)
  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar pagamentos';
  END IF;

  -- Buscar profile_id
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id AND tenant_id = v_tenant_id
  LIMIT 1;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Verificar se já existe pagamento para este atendimento
  IF EXISTS (
    SELECT 1 FROM public.accounts_receivable
    WHERE appointment_id = p_appointment_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Este atendimento já possui pagamento registrado';
  END IF;

  -- Criar registro em accounts_receivable
  INSERT INTO public.accounts_receivable (
    tenant_id, appointment_id, client_id, professional_id,
    service_price, amount_due, amount_paid,
    payment_source, payment_method, status, paid_at,
    description, notes, created_by
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    v_appointment.client_id,
    v_appointment.professional_id,
    v_appointment.effective_price,
    v_appointment.effective_price,
    p_amount,
    p_payment_source::public.payment_source,
    p_payment_method,
    CASE WHEN p_amount >= v_appointment.effective_price THEN 'paid' ELSE 'partial' END,
    now(),
    'Pagamento: ' || COALESCE(v_appointment.service_name, 'Serviço') || ' - ' || COALESCE(v_appointment.client_name, 'Cliente'),
    p_notes,
    v_profile_id
  )
  RETURNING id INTO v_receivable_id;

  -- Criar transação financeira (receita)
  INSERT INTO public.financial_transactions (
    tenant_id, appointment_id, type, category, amount, description, transaction_date
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    'income',
    'Serviço',
    p_amount,
    'Pagamento recebido: ' || COALESCE(v_appointment.service_name, 'Serviço') || ' - ' || COALESCE(v_appointment.client_name, 'Cliente'),
    v_tx_date
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'receivable_id', v_receivable_id,
    'transaction_id', v_transaction_id,
    'amount_paid', p_amount,
    'service_price', v_appointment.effective_price,
    'message', 'Pagamento registrado com sucesso'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_appointment_payment(uuid, numeric, text, text, text) TO authenticated;

-- ============================================================================
-- PARTE 5: RPC para calcular comissão sobre recebimentos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_professional_commission_on_receivables(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_commission_config RECORD;
  v_total_received NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_receivables_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar tenant do profissional
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = p_professional_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  -- Verificar permissões
  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem calcular comissões';
  END IF;

  -- Buscar configuração de comissão do profissional
  SELECT pc.*
  INTO v_commission_config
  FROM public.professional_commissions pc
  JOIN public.profiles p ON p.user_id = pc.user_id
  WHERE p.id = p_professional_id
    AND pc.tenant_id = v_tenant_id
    AND (pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission')
  ORDER BY pc.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_commission_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profissional não possui configuração de comissão',
      'total_received', 0,
      'commission_amount', 0
    );
  END IF;

  -- Calcular total recebido no período
  SELECT 
    COALESCE(SUM(ar.amount_paid), 0),
    COUNT(*)
  INTO v_total_received, v_receivables_count
  FROM public.accounts_receivable ar
  WHERE ar.professional_id = p_professional_id
    AND ar.tenant_id = v_tenant_id
    AND ar.status IN ('paid', 'partial')
    AND ar.paid_at >= p_start_date
    AND ar.paid_at < (p_end_date + INTERVAL '1 day');

  -- Calcular comissão
  IF v_commission_config.type = 'percentage' THEN
    v_commission_amount := v_total_received * (v_commission_config.value / 100);
  ELSE
    -- Comissão fixa por atendimento
    v_commission_amount := v_commission_config.value * v_receivables_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'professional_id', p_professional_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'total_received', v_total_received,
    'receivables_count', v_receivables_count,
    'commission_type', v_commission_config.type,
    'commission_value', v_commission_config.value,
    'commission_amount', v_commission_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_professional_commission_on_receivables(uuid, date, date) TO authenticated;

-- ============================================================================
-- PARTE 6: Comentários e documentação
-- ============================================================================

COMMENT ON TABLE public.accounts_receivable IS 
  'Fase 40: Contas a receber vinculadas a atendimentos. Receita só é gerada quando pagamento é registrado.';

COMMENT ON FUNCTION public.register_appointment_payment IS 
  'Fase 40: Registra pagamento de atendimento e gera receita financeira.';

COMMENT ON FUNCTION public.calculate_professional_commission_on_receivables IS 
  'Fase 40: Calcula comissão de profissional baseada em recebimentos (não atendimentos).';

-- ============================================================================
-- PARTE 7: Migração de dados históricos
-- ============================================================================
-- Cria accounts_receivable retroativos para atendimentos concluídos que já
-- tinham financial_transactions de income geradas pelo sistema antigo.
-- Isso preserva o histórico e permite que o novo sistema funcione corretamente.

INSERT INTO public.accounts_receivable (
  tenant_id,
  appointment_id,
  client_id,
  professional_id,
  service_price,
  amount_due,
  amount_paid,
  payment_source,
  status,
  paid_at,
  description,
  created_at
)
SELECT DISTINCT ON (ft.appointment_id)
  ft.tenant_id,
  ft.appointment_id,
  a.client_id,
  a.professional_id,
  COALESCE(a.price, ft.amount, 0),
  COALESCE(a.price, ft.amount, 0),
  ft.amount,
  'particular'::public.payment_source,
  'paid'::public.receivable_status,
  ft.created_at,
  ft.description,
  ft.created_at
FROM public.financial_transactions ft
JOIN public.appointments a ON a.id = ft.appointment_id
WHERE ft.type = 'income'
  AND ft.category = 'Serviço'
  AND ft.appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts_receivable ar
    WHERE ar.appointment_id = ft.appointment_id
  )
ORDER BY ft.appointment_id, ft.created_at DESC;

-- ============================================================================
-- PARTE 8: Trigger para criar conta a receber quando guia TISS é aprovada
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_receivable_on_tiss_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando uma guia TISS é aprovada (status muda para 'approved' ou 'partial')
  IF NEW.status IN ('approved', 'partial') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'partial')) THEN
    -- Criar conta a receber se não existir
    INSERT INTO public.accounts_receivable (
      tenant_id,
      appointment_id,
      client_id,
      tiss_guide_id,
      service_price,
      amount_due,
      amount_paid,
      payment_source,
      status,
      due_date,
      description
    )
    SELECT
      NEW.tenant_id,
      NEW.appointment_id,
      a.client_id,
      NEW.id,
      COALESCE(NEW.approved_value, NEW.total_value, 0),
      COALESCE(NEW.approved_value, NEW.total_value, 0),
      0,
      'insurance'::public.payment_source,
      'pending'::public.receivable_status,
      CURRENT_DATE + INTERVAL '30 days',
      'Guia TISS aprovada: ' || COALESCE(NEW.guide_number, NEW.id::text)
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
    AND NOT EXISTS (
      SELECT 1 FROM public.accounts_receivable ar
      WHERE ar.tiss_guide_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Nota: Este trigger só será criado se a tabela tiss_guides existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tiss_guides' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trigger_create_receivable_on_tiss_approval ON public.tiss_guides;
    CREATE TRIGGER trigger_create_receivable_on_tiss_approval
      AFTER UPDATE OF status ON public.tiss_guides
      FOR EACH ROW
      EXECUTE FUNCTION public.create_receivable_on_tiss_approval();
  END IF;
END $$;

COMMENT ON FUNCTION public.create_receivable_on_tiss_approval IS 
  'Fase 40: Cria conta a receber automaticamente quando guia TISS é aprovada pelo convênio.';
