-- ============================================================
-- MIGRAÇÃO: Planos de Tratamento Odontológico
-- Arquivo: 20260325100000_treatment_plans_v1.sql
-- Fase: 25C — Plano de Tratamento Odontológico
-- ============================================================

-- ─── 25C.1: Tabela principal de planos de tratamento ─────────────────────────

CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  odontogram_id   UUID REFERENCES public.odontograms(id) ON DELETE SET NULL,
  
  -- Identificação
  plan_number     TEXT,
  title           TEXT NOT NULL DEFAULT 'Plano de Tratamento',
  description     TEXT,
  
  -- Status do plano
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'apresentado', 'aprovado', 'em_andamento', 'concluido', 'cancelado')),
  
  -- Valores
  total_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_value  DECIMAL(12,2) DEFAULT 0,
  final_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Condições de pagamento
  payment_conditions TEXT,
  installments    INTEGER DEFAULT 1,
  
  -- Aprovação
  approved_at     TIMESTAMPTZ,
  approved_by_client BOOLEAN DEFAULT FALSE,
  client_signature TEXT,
  signature_ip    TEXT,
  
  -- Validade
  valid_until     DATE,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.treatment_plans IS 'Planos de tratamento odontológico — Fase 25C';

-- ─── 25C.2: Tabela de itens do plano (procedimentos por dente) ───────────────

CREATE TABLE IF NOT EXISTS public.treatment_plan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  
  -- Dente e face
  tooth_number    INTEGER CHECK (tooth_number BETWEEN 11 AND 48 OR tooth_number IS NULL),
  surface         TEXT,
  region          TEXT,
  
  -- Procedimento
  procedure_code  TEXT,
  procedure_name  TEXT NOT NULL,
  procedure_category TEXT,
  
  -- Valores
  unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL DEFAULT 1,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Status do item
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'agendado', 'em_andamento', 'concluido', 'cancelado')),
  
  -- Agendamento
  scheduled_date  DATE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Execução
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  
  -- Ordem de exibição
  sort_order      INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.treatment_plan_items IS 'Itens do plano de tratamento por dente/procedimento';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plan_items FORCE ROW LEVEL SECURITY;

-- Políticas para treatment_plans
DROP POLICY IF EXISTS "treatment_plans_select" ON public.treatment_plans;
CREATE POLICY "treatment_plans_select" ON public.treatment_plans
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "treatment_plans_insert" ON public.treatment_plans;
CREATE POLICY "treatment_plans_insert" ON public.treatment_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

DROP POLICY IF EXISTS "treatment_plans_update" ON public.treatment_plans;
CREATE POLICY "treatment_plans_update" ON public.treatment_plans
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

DROP POLICY IF EXISTS "treatment_plans_delete" ON public.treatment_plans;
CREATE POLICY "treatment_plans_delete" ON public.treatment_plans
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Políticas para treatment_plan_items
DROP POLICY IF EXISTS "treatment_plan_items_select" ON public.treatment_plan_items;
CREATE POLICY "treatment_plan_items_select" ON public.treatment_plan_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "treatment_plan_items_insert" ON public.treatment_plan_items;
CREATE POLICY "treatment_plan_items_insert" ON public.treatment_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), p.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "treatment_plan_items_update" ON public.treatment_plan_items;
CREATE POLICY "treatment_plan_items_update" ON public.treatment_plan_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), p.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "treatment_plan_items_delete" ON public.treatment_plan_items;
CREATE POLICY "treatment_plan_items_delete" ON public.treatment_plan_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND public.is_tenant_admin(auth.uid(), p.tenant_id)
    )
  );

-- ─── Índices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_treatment_plans_tenant_client ON public.treatment_plans(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_professional ON public.treatment_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON public.treatment_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan ON public.treatment_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_status ON public.treatment_plan_items(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth ON public.treatment_plan_items(plan_id, tooth_number);

-- ─── Triggers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_treatment_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_treatment_plans_updated_at ON public.treatment_plans;
CREATE TRIGGER trg_treatment_plans_updated_at
  BEFORE UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_treatment_plan_updated_at();

DROP TRIGGER IF EXISTS trg_treatment_plan_items_updated_at ON public.treatment_plan_items;
CREATE TRIGGER trg_treatment_plan_items_updated_at
  BEFORE UPDATE ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_treatment_plan_updated_at();

-- Trigger para recalcular totais do plano
CREATE OR REPLACE FUNCTION public.recalculate_treatment_plan_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total DECIMAL(12,2);
  v_plan_discount DECIMAL(5,2);
  v_discount_val DECIMAL(12,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_total
  FROM public.treatment_plan_items
  WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  SELECT discount_percent INTO v_plan_discount
  FROM public.treatment_plans
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  v_discount_val := v_total * COALESCE(v_plan_discount, 0) / 100;
  
  UPDATE public.treatment_plans
  SET 
    total_value = v_total,
    discount_value = v_discount_val,
    final_value = v_total - v_discount_val
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_plan_totals_insert ON public.treatment_plan_items;
CREATE TRIGGER trg_recalc_plan_totals_insert
  AFTER INSERT ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();

DROP TRIGGER IF EXISTS trg_recalc_plan_totals_update ON public.treatment_plan_items;
CREATE TRIGGER trg_recalc_plan_totals_update
  AFTER UPDATE OF total_price ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();

DROP TRIGGER IF EXISTS trg_recalc_plan_totals_delete ON public.treatment_plan_items;
CREATE TRIGGER trg_recalc_plan_totals_delete
  AFTER DELETE ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();

-- ─── RPCs ────────────────────────────────────────────────────────────────────

-- RPC: Listar planos de um paciente
CREATE OR REPLACE FUNCTION public.get_client_treatment_plans(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  plan_number TEXT,
  title TEXT,
  status TEXT,
  total_value DECIMAL,
  final_value DECIMAL,
  items_count BIGINT,
  items_completed BIGINT,
  professional_name TEXT,
  created_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 
    p.id,
    p.plan_number,
    p.title,
    p.status,
    p.total_value,
    p.final_value,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id) as items_count,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id AND i.status = 'concluido') as items_completed,
    pr.full_name as professional_name,
    p.created_at,
    p.approved_at
  FROM public.treatment_plans p
  LEFT JOIN public.profiles pr ON pr.id = p.professional_id
  WHERE p.tenant_id = p_tenant_id AND p.client_id = p_client_id
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_treatment_plans(UUID, UUID) TO authenticated;

-- RPC: Buscar plano com itens
CREATE OR REPLACE FUNCTION public.get_treatment_plan_with_items(p_plan_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_plan JSON;
  v_items JSON;
BEGIN
  SELECT row_to_json(p) INTO v_plan
  FROM (
    SELECT 
      tp.*,
      c.name as client_name,
      c.cpf as client_cpf,
      pr.full_name as professional_name,
      pr.council_number,
      pr.council_state
    FROM public.treatment_plans tp
    LEFT JOIN public.clients c ON c.id = tp.client_id
    LEFT JOIN public.profiles pr ON pr.id = tp.professional_id
    WHERE tp.id = p_plan_id
  ) p;
  
  SELECT COALESCE(json_agg(i ORDER BY i.sort_order, i.tooth_number), '[]'::JSON) INTO v_items
  FROM public.treatment_plan_items i
  WHERE i.plan_id = p_plan_id;
  
  RETURN json_build_object('plan', v_plan, 'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_treatment_plan_with_items(UUID) TO authenticated;

-- RPC: Aprovar plano pelo paciente
CREATE OR REPLACE FUNCTION public.approve_treatment_plan(
  p_plan_id UUID,
  p_signature TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.treatment_plans
  SET 
    status = 'aprovado',
    approved_at = NOW(),
    approved_by_client = TRUE,
    client_signature = p_signature,
    signature_ip = p_ip
  WHERE id = p_plan_id AND status IN ('pendente', 'apresentado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_treatment_plan(UUID, TEXT, TEXT) TO authenticated;

-- RPC: Marcar item como concluído
CREATE OR REPLACE FUNCTION public.complete_treatment_plan_item(
  p_item_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan_id UUID;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  UPDATE public.treatment_plan_items
  SET 
    status = 'concluido',
    completed_at = NOW(),
    completed_by = auth.uid(),
    notes = COALESCE(p_notes, notes)
  WHERE id = p_item_id
  RETURNING plan_id INTO v_plan_id;
  
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluido')
  INTO v_total_items, v_completed_items
  FROM public.treatment_plan_items
  WHERE plan_id = v_plan_id;
  
  IF v_completed_items = v_total_items THEN
    UPDATE public.treatment_plans SET status = 'concluido' WHERE id = v_plan_id;
  ELSIF v_completed_items > 0 THEN
    UPDATE public.treatment_plans SET status = 'em_andamento' WHERE id = v_plan_id AND status = 'aprovado';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_treatment_plan_item(UUID, TEXT) TO authenticated;

-- RPC: Calcular progresso do plano
CREATE OR REPLACE FUNCTION public.get_treatment_plan_progress(p_plan_id UUID)
RETURNS JSON LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_items', COUNT(*),
    'completed_items', COUNT(*) FILTER (WHERE status = 'concluido'),
    'pending_items', COUNT(*) FILTER (WHERE status = 'pendente'),
    'scheduled_items', COUNT(*) FILTER (WHERE status = 'agendado'),
    'in_progress_items', COUNT(*) FILTER (WHERE status = 'em_andamento'),
    'cancelled_items', COUNT(*) FILTER (WHERE status = 'cancelado'),
    'completion_percent', CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'concluido')::DECIMAL / COUNT(*)) * 100, 1)
      ELSE 0 END,
    'total_value', SUM(total_price),
    'completed_value', SUM(total_price) FILTER (WHERE status = 'concluido')
  )
  FROM public.treatment_plan_items
  WHERE plan_id = p_plan_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_treatment_plan_progress(UUID) TO authenticated;

-- ─── Sequência para número do plano ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_plan_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.treatment_plans
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  RETURN 'PT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Trigger para gerar número automaticamente
CREATE OR REPLACE FUNCTION public.set_plan_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_number IS NULL THEN
    NEW.plan_number := public.generate_plan_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_plan_number ON public.treatment_plans;
CREATE TRIGGER trg_set_plan_number
  BEFORE INSERT ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_number();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
