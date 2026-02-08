-- Sugestões de meta: profissional propõe, admin aprova ou rejeita

CREATE TABLE IF NOT EXISTS public.goal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  goal_type public.goal_type NOT NULL,
  target_value DECIMAL(15,2) NOT NULL CHECK (target_value > 0),
  period public.goal_period NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_suggestions_tenant ON public.goal_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_suggestions_professional ON public.goal_suggestions(professional_id);
CREATE INDEX IF NOT EXISTS idx_goal_suggestions_status ON public.goal_suggestions(tenant_id, status);

ALTER TABLE public.goal_suggestions ENABLE ROW LEVEL SECURITY;

-- Staff: pode criar sugestão (para si) e ver suas próprias sugestões
CREATE POLICY "Staff can create own suggestions"
  ON public.goal_suggestions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE id = professional_id
    )
    AND tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view own suggestions"
  ON public.goal_suggestions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id = professional_id)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_suggestions.tenant_id AND ur.role = 'admin')
  );

-- Admin: pode ver todas, atualizar (aprovar/rejeitar)
CREATE POLICY "Admin can manage suggestions"
  ON public.goal_suggestions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_suggestions.tenant_id AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_suggestions.tenant_id AND ur.role = 'admin'
    )
  );
