-- GCP Migration: RLS Policies - ai_automation
-- Total: 3 policies


-- ── Table: ai_performance_metrics ──
ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_select" ON public.ai_performance_metrics
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_insert_service" ON public.ai_performance_metrics
  FOR INSERT WITH CHECK (true);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_update_feedback" ON public.ai_performance_metrics
  FOR UPDATE USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  ) WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

