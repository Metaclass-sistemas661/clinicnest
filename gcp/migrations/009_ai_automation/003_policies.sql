-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_ai_automation.sql
-- Execution Order: 015
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: RLS Policies - ai_automation
-- Total: 3 policies


-- ── Table: ai_performance_metrics ──
ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_select" ON public.ai_performance_metrics
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = current_setting('app.current_user_id')::uuid
    )
  );

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_insert_service" ON public.ai_performance_metrics
  FOR INSERT WITH CHECK (true);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE POLICY "ai_metrics_update_feedback" ON public.ai_performance_metrics
  FOR UPDATE USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = current_setting('app.current_user_id')::uuid
    )
  ) WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = current_setting('app.current_user_id')::uuid
    )
  );

