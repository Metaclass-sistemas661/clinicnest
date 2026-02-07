-- Sistema de Metas do Salão

DO $$ BEGIN
  CREATE TYPE public.goal_type AS ENUM ('revenue', 'services_count', 'product_quantity', 'product_revenue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_period AS ENUM ('weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type public.goal_type NOT NULL,
  target_value DECIMAL(15,2) NOT NULL CHECK (target_value > 0),
  period public.goal_period NOT NULL DEFAULT 'monthly',
  professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  show_in_header BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_tenant ON public.goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goals_active ON public.goals(tenant_id, is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia metas do tenant"
  ON public.goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = goals.tenant_id
      AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = goals.tenant_id
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Staff vê metas do tenant (somente leitura)"
  ON public.goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = goals.tenant_id
    )
  );
