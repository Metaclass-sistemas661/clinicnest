-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_inventory.sql
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

-- GCP Migration: RLS Policies - inventory
-- Total: 1 policies


-- ── Table: product_usage ──
ALTER TABLE public.product_usage ENABLE ROW LEVEL SECURITY;

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE POLICY "product_usage_tenant_isolation" ON public.product_usage
  FOR ALL USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID)
  WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID);

