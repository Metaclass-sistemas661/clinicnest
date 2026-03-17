-- ============================================================================
-- AI Performance Metrics — Telemetria e feedback loop para módulos de IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_performance_metrics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  interaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_name   text NOT NULL CHECK (module_name IN ('copilot','gps','triage','automation','chatbot')),
  prompt_tokens  integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  latency_ms    integer DEFAULT 0,
  confidence_score numeric(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  user_feedback  text CHECK (user_feedback IS NULL OR user_feedback IN ('accepted','rejected','partial')),
  model_id      text,
  request_payload jsonb DEFAULT '{}',
  response_summary text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices para dashboards e análise
CREATE INDEX idx_ai_metrics_tenant_module ON public.ai_performance_metrics(tenant_id, module_name);
CREATE INDEX idx_ai_metrics_created ON public.ai_performance_metrics(created_at DESC);
CREATE INDEX idx_ai_metrics_interaction ON public.ai_performance_metrics(interaction_id);
CREATE INDEX idx_ai_metrics_feedback ON public.ai_performance_metrics(user_feedback) WHERE user_feedback IS NOT NULL;

-- RLS
ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Membros do tenant podem ler suas próprias métricas
CREATE POLICY "ai_metrics_select" ON public.ai_performance_metrics
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Apenas service_role insere (via Edge Functions)
CREATE POLICY "ai_metrics_insert_service" ON public.ai_performance_metrics
  FOR INSERT WITH CHECK (true);

-- Update para feedback — usuário só atualiza user_feedback do próprio tenant
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

-- ============================================================================
-- RPC: Registrar feedback do usuário por interaction_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_ai_feedback(
  p_interaction_id uuid,
  p_feedback text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_feedback NOT IN ('accepted', 'rejected', 'partial') THEN
    RAISE EXCEPTION 'Feedback inválido: %', p_feedback;
  END IF;

  UPDATE public.ai_performance_metrics
  SET user_feedback = p_feedback
  WHERE interaction_id = p_interaction_id
    AND tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    );
END;
$$;
