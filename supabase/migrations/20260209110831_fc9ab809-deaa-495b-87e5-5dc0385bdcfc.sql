-- =====================================================
-- SISTEMA DE COMISSÕES - Tabela e RPCs
-- =====================================================

-- 1. Tabela commission_payments para armazenar comissões geradas
DO $$
BEGIN
  CREATE TABLE public.commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL, -- user_id do profissional (auth.uid)
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    service_price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    payment_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commission_payments_tenant ON public.commission_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_professional ON public.commission_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON public.commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_created ON public.commission_payments(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_commission_payments_updated_at ON public.commission_payments;
CREATE TRIGGER update_commission_payments_updated_at
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- Staff vê apenas suas próprias comissões
DO $$
BEGIN
  CREATE POLICY "Staff can view own commissions"
    ON public.commission_payments FOR SELECT
    USING (
      tenant_id = get_user_tenant_id(auth.uid()) 
      AND (professional_id = auth.uid() OR is_tenant_admin(auth.uid(), tenant_id))
    );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Admin pode criar comissões
DO $$
BEGIN
  CREATE POLICY "Admins can create commissions"
    ON public.commission_payments FOR INSERT
    WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Admin pode atualizar (pagar) comissões
DO $$
BEGIN
  CREATE POLICY "Admins can update commissions"
    ON public.commission_payments FOR UPDATE
    USING (is_tenant_admin(auth.uid(), tenant_id))
    WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Admin pode deletar
DO $$
BEGIN
  CREATE POLICY "Admins can delete commissions"
    ON public.commission_payments FOR DELETE
    USING (is_tenant_admin(auth.uid(), tenant_id));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- =====================================================
-- 2. RPC: complete_appointment_with_sale
-- Conclui agendamento e cria registro de comissão
-- =====================================================
DROP FUNCTION IF EXISTS public.complete_appointment_with_sale(UUID, UUID, INTEGER);
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

  -- Buscar profissional
  SELECT p.id, p.user_id, p.full_name
  INTO v_professional
  FROM profiles p
  WHERE p.id = v_appointment.professional_id;

  -- Buscar configuração de comissão do profissional
  IF v_professional.user_id IS NOT NULL THEN
    SELECT pc.type, pc.value
    INTO v_commission_config
    FROM professional_commissions pc
    WHERE pc.user_id = v_professional.user_id
      AND pc.tenant_id = v_appointment.tenant_id;

    -- Calcular comissão
    IF v_commission_config IS NOT NULL AND v_commission_config.value > 0 THEN
      IF v_commission_config.type = 'percentage' THEN
        v_commission_amount := (v_appointment.price * v_commission_config.value) / 100;
      ELSE
        v_commission_amount := v_commission_config.value;
      END IF;

      -- Criar registro de comissão
      INSERT INTO commission_payments (
        tenant_id,
        professional_id,
        appointment_id,
        amount,
        service_price,
        status,
        notes
      ) VALUES (
        v_appointment.tenant_id,
        v_professional.user_id,
        p_appointment_id,
        v_commission_amount,
        v_appointment.price,
        'pending',
        'Comissão por ' || COALESCE(v_appointment.service_name, 'serviço')
      );
    END IF;
  END IF;

  -- Retornar dados
  v_result := jsonb_build_object(
    'commission_amount', v_commission_amount,
    'service_price', v_appointment.price,
    'service_name', v_appointment.service_name,
    'professional_name', COALESCE(v_professional.full_name, 'Profissional')
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 3. RPC: get_dashboard_commission_totals
-- Retorna totais de comissões para dashboard
-- =====================================================
DROP FUNCTION IF EXISTS public.get_dashboard_commission_totals(UUID, BOOLEAN, UUID);
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

  IF p_is_admin THEN
    -- Admin: soma de todas as comissões do tenant
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM commission_payments
    WHERE tenant_id = p_tenant_id
      AND created_at >= v_month_start
      AND created_at <= v_month_end;
  ELSE
    -- Staff: apenas suas comissões
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM commission_payments
    WHERE tenant_id = p_tenant_id
      AND professional_id = p_professional_user_id
      AND created_at >= v_month_start
      AND created_at <= v_month_end;
  END IF;

  RETURN jsonb_build_object(
    'pending', v_pending,
    'paid', v_paid
  );
END;
$$;