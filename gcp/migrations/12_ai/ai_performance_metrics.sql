-- Table: ai_performance_metrics
-- Domain: 12_ai
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ai_performance_metrics (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,
  success BOOLEAN DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completion_tokens INTEGER DEFAULT 0,
  confidence_score NUMERIC,
  interaction_id UUID DEFAULT gen_random_uuid() NOT NULL,
  model_id TEXT,
  module_name TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  request_payload JSONB DEFAULT '{}',
  response_summary TEXT,
  user_feedback TEXT,
  user_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

CREATE INDEX idx_ai_metrics_tenant ON public.ai_performance_metrics USING btree (tenant_id);
