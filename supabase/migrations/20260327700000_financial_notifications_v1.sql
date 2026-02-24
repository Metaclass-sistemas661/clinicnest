-- Fase 32C: Notificações financeiras discretas para profissionais
-- Substitui pop-ups por notificações in-app

-- Adicionar preferências de notificação financeira
ALTER TABLE public.user_notification_preferences
ADD COLUMN IF NOT EXISTS commission_generated BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS salary_paid BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_financial_summary BOOLEAN NOT NULL DEFAULT false;

-- Adicionar configuração para mostrar média da clínica aos profissionais
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS show_clinic_average_to_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.show_clinic_average_to_staff IS 'Se true, profissionais podem ver comparativo com média da clínica no portal financeiro';

-- Tabela para contestações de comissão
CREATE TABLE IF NOT EXISTS public.commission_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response TEXT,
  resolved_by UUID REFERENCES public.profiles(user_id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_disputes_tenant ON public.commission_disputes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_professional ON public.commission_disputes(professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_status ON public.commission_disputes(status);

ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals view own disputes"
  ON public.commission_disputes FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "Professionals create own disputes"
  ON public.commission_disputes FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Admins view all disputes"
  ON public.commission_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = tenant_id 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins update disputes"
  ON public.commission_disputes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = tenant_id 
      AND ur.role = 'admin'
    )
  );

-- Função para notificar profissional quando comissão é gerada
CREATE OR REPLACE FUNCTION public.notify_commission_generated()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_name TEXT;
  v_service_name TEXT;
  v_client_name TEXT;
  v_percentage NUMERIC;
  v_wants_notification BOOLEAN;
BEGIN
  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(commission_generated, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Buscar dados para a notificação
  SELECT full_name INTO v_professional_name
  FROM public.profiles
  WHERE user_id = NEW.professional_id;

  -- Buscar nome do serviço e cliente via appointment
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT 
      s.name,
      c.name
    INTO v_service_name, v_client_name
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE a.id = NEW.appointment_id;
  END IF;

  -- Calcular percentual
  IF NEW.service_price > 0 THEN
    v_percentage := ROUND((NEW.amount / NEW.service_price) * 100, 0);
  ELSE
    v_percentage := 0;
  END IF;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'commission_generated',
    'Comissão gerada',
    format(
      'Comissão de R$ %s gerada (%s%% de R$ %s)%s',
      to_char(NEW.amount, 'FM999G999D00'),
      v_percentage::TEXT,
      to_char(NEW.service_price, 'FM999G999D00'),
      CASE WHEN v_service_name IS NOT NULL THEN ' - ' || v_service_name ELSE '' END
    ),
    jsonb_build_object(
      'commission_id', NEW.id,
      'amount', NEW.amount,
      'service_price', NEW.service_price,
      'percentage', v_percentage,
      'service_name', v_service_name,
      'client_name', v_client_name,
      'appointment_id', NEW.appointment_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para notificar profissional quando comissão é paga
CREATE OR REPLACE FUNCTION public.notify_commission_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_wants_notification BOOLEAN;
  v_total_paid NUMERIC;
BEGIN
  -- Só notificar quando status muda para 'paid'
  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(commission_paid, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'commission_paid',
    'Comissão paga',
    format('Sua comissão de R$ %s foi paga!', to_char(NEW.amount, 'FM999G999D00')),
    jsonb_build_object(
      'commission_id', NEW.id,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para notificar profissional quando salário é pago
CREATE OR REPLACE FUNCTION public.notify_salary_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_wants_notification BOOLEAN;
  v_month_name TEXT;
  v_payment_method_label TEXT;
BEGIN
  -- Só notificar quando status muda para 'paid'
  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(salary_paid, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Nome do mês
  v_month_name := to_char(make_date(NEW.payment_year, NEW.payment_month, 1), 'TMMonth');

  -- Label do método de pagamento
  v_payment_method_label := CASE NEW.payment_method
    WHEN 'pix' THEN 'via PIX'
    WHEN 'deposit' THEN 'via depósito'
    WHEN 'transfer' THEN 'via transferência'
    WHEN 'cash' THEN 'em espécie'
    ELSE ''
  END;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'salary_paid',
    'Salário pago',
    format(
      'Seu salário de %s (R$ %s) foi pago%s',
      v_month_name,
      to_char(NEW.amount, 'FM999G999D00'),
      CASE WHEN v_payment_method_label != '' THEN ' ' || v_payment_method_label ELSE '' END
    ),
    jsonb_build_object(
      'salary_id', NEW.id,
      'amount', NEW.amount,
      'payment_month', NEW.payment_month,
      'payment_year', NEW.payment_year,
      'payment_method', NEW.payment_method,
      'payment_date', NEW.payment_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers
DROP TRIGGER IF EXISTS trg_notify_commission_generated ON public.commission_payments;
CREATE TRIGGER trg_notify_commission_generated
  AFTER INSERT ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_commission_generated();

DROP TRIGGER IF EXISTS trg_notify_commission_paid ON public.commission_payments;
CREATE TRIGGER trg_notify_commission_paid
  AFTER UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_commission_paid();

DROP TRIGGER IF EXISTS trg_notify_salary_paid ON public.salary_payments;
CREATE TRIGGER trg_notify_salary_paid
  AFTER UPDATE ON public.salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_salary_paid();

-- Comentários
COMMENT ON FUNCTION public.notify_commission_generated() IS 'Cria notificação in-app quando comissão é gerada para profissional';
COMMENT ON FUNCTION public.notify_commission_paid() IS 'Cria notificação in-app quando comissão é marcada como paga';
COMMENT ON FUNCTION public.notify_salary_paid() IS 'Cria notificação in-app quando salário é marcado como pago';
