-- Metas: Novos tipos, período trimestral, arquivar, data customizada, prioridade

-- Novos tipos de meta (safe: IF NOT EXISTS evita erro se já existir)
DO $$ BEGIN
  ALTER TYPE public.goal_type ADD VALUE 'clientes_novos';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.goal_type ADD VALUE 'ticket_medio';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Período trimestral
DO $$ BEGIN
  ALTER TYPE public.goal_period ADD VALUE 'quarterly';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Novas colunas na tabela goals (DO block evita erro se já existirem)
DO $$ BEGIN
  ALTER TABLE public.goals ADD COLUMN archived_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.goals ADD COLUMN custom_start DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.goals ADD COLUMN custom_end DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.goals ADD COLUMN header_priority INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.goals ADD COLUMN parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON COLUMN public.goals.archived_at IS 'Quando arquivada; null = ativa';
COMMENT ON COLUMN public.goals.custom_start IS 'Início customizado do período; null = usa período padrão';
COMMENT ON COLUMN public.goals.custom_end IS 'Fim customizado do período; null = usa período padrão';
COMMENT ON COLUMN public.goals.header_priority IS 'Ordem no cabeçalho; 0 = não exibe';
COMMENT ON COLUMN public.goals.parent_goal_id IS 'Meta agregada; soma de submetas';

-- Tabela de templates de meta
CREATE TABLE IF NOT EXISTS public.goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type public.goal_type NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  period public.goal_period NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_templates_tenant ON public.goal_templates(tenant_id);
ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia templates do tenant"
  ON public.goal_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_templates.tenant_id AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_templates.tenant_id AND ur.role = 'admin'
    )
  );

-- Tabela de conquistas (badges/streaks)
CREATE TABLE IF NOT EXISTS public.goal_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT goal_achievements_type_check CHECK (
    achievement_type IN ('goal_reached', 'streak', 'badge', 'level')
  )
);

CREATE INDEX IF NOT EXISTS idx_goal_achievements_tenant ON public.goal_achievements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal ON public.goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_professional ON public.goal_achievements(professional_id);
ALTER TABLE public.goal_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view achievements in their tenant"
  ON public.goal_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_achievements.tenant_id
    )
  );

CREATE POLICY "Admin manages achievements"
  ON public.goal_achievements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_achievements.tenant_id AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = goal_achievements.tenant_id AND ur.role = 'admin'
    )
  );
