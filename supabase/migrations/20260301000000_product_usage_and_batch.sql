-- Sprint 5 R15: Adicionar campos de lote/validade em stock_movements
-- e tabela de vínculo produto → paciente → sessão

-- 1. Adicionar lote e validade nas movimentações de estoque
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 2. Tabela de uso de produto por paciente por sessão
CREATE TABLE IF NOT EXISTS public.product_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  batch_number TEXT,
  expiry_date DATE,
  zone TEXT,           -- zona de aplicação (face/corpo zone id)
  procedure_type TEXT, -- tipo de procedimento (aesthetic procedure key)
  notes TEXT,
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.product_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_usage_tenant_isolation" ON public.product_usage
  FOR ALL USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID)
  WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_usage_tenant ON public.product_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_usage_product ON public.product_usage(product_id);
CREATE INDEX IF NOT EXISTS idx_product_usage_patient ON public.product_usage(patient_id);
CREATE INDEX IF NOT EXISTS idx_product_usage_appointment ON public.product_usage(appointment_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON public.stock_movements(batch_number) WHERE batch_number IS NOT NULL;
