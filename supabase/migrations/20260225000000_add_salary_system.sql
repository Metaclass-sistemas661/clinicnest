-- =====================================================
-- SISTEMA DE SALÁRIO FIXO PARA STAFFS
-- Adiciona suporte para salário fixo além de comissões
-- =====================================================

-- 1. Adicionar campos de salário na tabela professional_commissions
-- Estes campos são opcionais e não quebram o sistema existente
DO $$ 
BEGIN
  -- Adicionar payment_type se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'professional_commissions' 
    AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.professional_commissions
    ADD COLUMN payment_type TEXT DEFAULT 'commission' 
      CHECK (payment_type IN ('commission', 'salary'));
  END IF;

  -- Adicionar salary_amount se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'professional_commissions' 
    AND column_name = 'salary_amount'
  ) THEN
    ALTER TABLE public.professional_commissions
    ADD COLUMN salary_amount DECIMAL(10,2);
  END IF;

  -- Adicionar salary_payment_day se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'professional_commissions' 
    AND column_name = 'salary_payment_day'
  ) THEN
    ALTER TABLE public.professional_commissions
    ADD COLUMN salary_payment_day INTEGER 
      CHECK (salary_payment_day IS NULL OR (salary_payment_day >= 1 AND salary_payment_day <= 31));
  END IF;

  -- Adicionar default_payment_method se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'professional_commissions' 
    AND column_name = 'default_payment_method'
  ) THEN
    ALTER TABLE public.professional_commissions
    ADD COLUMN default_payment_method TEXT 
      CHECK (default_payment_method IS NULL OR default_payment_method IN ('pix', 'deposit', 'cash', 'other'));
  END IF;
END $$;

-- 2. Criar tabela salary_payments para registrar pagamentos de salário
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  professional_commission_id UUID REFERENCES public.professional_commissions(id) ON DELETE SET NULL,
  
  -- Período do salário
  payment_month INTEGER NOT NULL CHECK (payment_month >= 1 AND payment_month <= 12),
  payment_year INTEGER NOT NULL CHECK (payment_year >= 2020),
  
  -- Valores
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  
  -- Status e pagamento
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('pix', 'deposit', 'cash', 'other')),
  payment_reference TEXT, -- Número do PIX, comprovante, etc
  
  -- Metadados
  paid_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant ON public.salary_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_professional ON public.salary_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON public.salary_payments(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON public.salary_payments(payment_year, payment_month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON public.salary_payments(payment_date);

-- 4. Criar constraint UNIQUE para evitar pagamentos duplicados no mesmo período
-- Usando partial unique index para permitir múltiplos 'pending' mas apenas um 'paid'
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_payments_unique_paid 
ON public.salary_payments(tenant_id, professional_id, payment_year, payment_month) 
WHERE status = 'paid';

-- 5. Adicionar trigger updated_at
DROP TRIGGER IF EXISTS update_salary_payments_updated_at ON public.salary_payments;
CREATE TRIGGER update_salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Adicionar campo salary_payment_id em financial_transactions (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'financial_transactions' 
    AND column_name = 'salary_payment_id'
  ) THEN
    ALTER TABLE public.financial_transactions
    ADD COLUMN salary_payment_id UUID REFERENCES public.salary_payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Habilitar RLS na tabela salary_payments
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas RLS para salary_payments
-- SELECT: Staff vê seus próprios salários, admin vê todos do tenant
DROP POLICY IF EXISTS "Staff can view own salaries" ON public.salary_payments;
CREATE POLICY "Staff can view own salaries"
  ON public.salary_payments FOR SELECT
  USING (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
    )
  );

-- INSERT: Apenas admin
DROP POLICY IF EXISTS "Admins can create salary payments" ON public.salary_payments;
CREATE POLICY "Admins can create salary payments"
  ON public.salary_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
    )
  );

-- UPDATE: Apenas admin
DROP POLICY IF EXISTS "Admins can update salary payments" ON public.salary_payments;
CREATE POLICY "Admins can update salary payments"
  ON public.salary_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
    )
  );

-- DELETE: Apenas admin
DROP POLICY IF EXISTS "Admins can delete salary payments" ON public.salary_payments;
CREATE POLICY "Admins can delete salary payments"
  ON public.salary_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
    )
  );

-- 9. Criar RPC para pagar salário
CREATE OR REPLACE FUNCTION public.pay_salary(
  p_professional_id UUID,
  p_payment_month INTEGER,
  p_payment_year INTEGER,
  p_payment_method TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_commission_config RECORD;
  v_salary_amount NUMERIC;
  v_salary_payment_id UUID;
  v_financial_transaction_id UUID;
  v_professional_name TEXT;
BEGIN
  -- Buscar tenant_id e configuração de salário
  SELECT p.tenant_id, p.full_name INTO v_tenant_id, v_professional_name
  FROM profiles p
  WHERE p.user_id = p_professional_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  -- Buscar configuração de salário
  SELECT * INTO v_commission_config
  FROM professional_commissions
  WHERE user_id = p_professional_id
    AND tenant_id = v_tenant_id
    AND payment_type = 'salary'
  LIMIT 1;

  IF v_commission_config IS NULL THEN
    RAISE EXCEPTION 'Profissional não possui salário fixo configurado';
  END IF;

  IF v_commission_config.salary_amount IS NULL OR v_commission_config.salary_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do salário não configurado ou inválido';
  END IF;

  v_salary_amount := v_commission_config.salary_amount;

  -- Verificar se já existe pagamento pago para este período
  IF EXISTS (
    SELECT 1 FROM salary_payments
    WHERE tenant_id = v_tenant_id
      AND professional_id = p_professional_id
      AND payment_month = p_payment_month
      AND payment_year = p_payment_year
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Salário já foi pago para este período';
  END IF;

  -- Criar ou atualizar registro de pagamento de salário
  INSERT INTO salary_payments (
    tenant_id,
    professional_id,
    professional_commission_id,
    payment_month,
    payment_year,
    amount,
    status,
    payment_date,
    payment_method,
    payment_reference,
    paid_by,
    notes
  ) VALUES (
    v_tenant_id,
    p_professional_id,
    v_commission_config.id,
    p_payment_month,
    p_payment_year,
    v_salary_amount,
    'paid',
    CURRENT_DATE,
    p_payment_method,
    p_payment_reference,
    auth.uid(),
    p_notes
  )
  ON CONFLICT (tenant_id, professional_id, payment_year, payment_month) 
  WHERE status = 'paid'
  DO NOTHING
  RETURNING id INTO v_salary_payment_id;

  -- Se não inseriu (conflito), buscar o ID existente
  IF v_salary_payment_id IS NULL THEN
    SELECT id INTO v_salary_payment_id
    FROM salary_payments
    WHERE tenant_id = v_tenant_id
      AND professional_id = p_professional_id
      AND payment_month = p_payment_month
      AND payment_year = p_payment_year
      AND status = 'paid'
    LIMIT 1;
  END IF;

  -- Criar transação financeira (despesa) se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM financial_transactions
    WHERE salary_payment_id = v_salary_payment_id
  ) THEN
    INSERT INTO financial_transactions (
      tenant_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      salary_payment_id
    ) VALUES (
      v_tenant_id,
      'expense',
      'Funcionários',
      v_salary_amount,
      'Salário - ' || COALESCE(v_professional_name, 'Profissional') || 
      ' - ' || TO_CHAR(TO_DATE(p_payment_year || '-' || LPAD(p_payment_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD'), 'MM/YYYY'),
      CURRENT_DATE,
      v_salary_payment_id
    )
    RETURNING id INTO v_financial_transaction_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'salary_payment_id', v_salary_payment_id,
    'financial_transaction_id', COALESCE(v_financial_transaction_id, NULL),
    'amount', v_salary_amount,
    'professional_name', v_professional_name
  );
END;
$$;

-- 10. Criar RPC para buscar pagamentos de salário
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
      'professional_name', p.full_name,
      'payment_month', sp.payment_month,
      'payment_year', sp.payment_year,
      'amount', sp.amount,
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
  JOIN profiles p ON p.user_id = sp.professional_id
  WHERE sp.tenant_id = p_tenant_id
    AND (p_professional_id IS NULL OR sp.professional_id = p_professional_id)
    AND (p_year IS NULL OR sp.payment_year = p_year)
    AND (p_month IS NULL OR sp.payment_month = p_month)
  ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 11. Criar RPC para buscar profissionais com salário fixo configurado
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
      'professional_name', p.full_name,
      'salary_amount', pc.salary_amount,
      'salary_payment_day', pc.salary_payment_day,
      'default_payment_method', pc.default_payment_method,
      'commission_id', pc.id
    )
  )
  INTO v_result
  FROM professional_commissions pc
  JOIN profiles p ON p.user_id = pc.user_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.payment_type = 'salary'
    AND pc.salary_amount IS NOT NULL
    AND pc.salary_amount > 0
  ORDER BY p.full_name;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
