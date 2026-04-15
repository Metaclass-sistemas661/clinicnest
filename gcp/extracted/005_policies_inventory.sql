-- GCP Migration: RLS Policies - inventory
-- Total: 1 policies


-- ── Table: product_usage ──
ALTER TABLE public.product_usage ENABLE ROW LEVEL SECURITY;

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE POLICY "product_usage_tenant_isolation" ON public.product_usage
  FOR ALL USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID)
  WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true))::UUID);

