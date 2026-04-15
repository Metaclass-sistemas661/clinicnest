-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_financial.sql
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

-- GCP Migration: RLS Policies - financial
-- Total: 25 policies


-- ── Table: asaas_checkout_sessions ──
ALTER TABLE public.asaas_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Source: 20260216132000_rls_audit_fixes_public.sql
create policy "service_role_all" on public.asaas_checkout_sessions
for all
to public
using (current_setting('app.user_role')::text = 'service_role')
with check (current_setting('app.user_role')::text = 'service_role');


-- ── Table: asaas_webhook_alerts ──
ALTER TABLE public.asaas_webhook_alerts ENABLE ROW LEVEL SECURITY;

-- Source: 20260216132000_rls_audit_fixes_public.sql
create policy "service_role_all" on public.asaas_webhook_alerts
for all
to public
using (current_setting('app.user_role')::text = 'service_role')
with check (current_setting('app.user_role')::text = 'service_role');


-- ── Table: asaas_webhook_events ──
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Source: 20260214153000_asaas_webhook_events.sql
create policy "service_role_all" on public.asaas_webhook_events
for all
to public
using (current_setting('app.user_role')::text = 'service_role')
with check (current_setting('app.user_role')::text = 'service_role');


-- ── Table: cash_movements ──
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Source: 20260218220000_cash_register_v1.sql
CREATE POLICY "cash_movements_tenant_read" ON public.cash_movements FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218220000_cash_register_v1.sql
CREATE POLICY "cash_movements_service_write" ON public.cash_movements FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: cash_sessions ──
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Source: 20260218220000_cash_register_v1.sql
CREATE POLICY "cash_sessions_tenant_read" ON public.cash_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218220000_cash_register_v1.sql
CREATE POLICY "cash_sessions_service_write" ON public.cash_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: discount_coupons ──
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "discount_coupons tenant isolation" ON discount_coupons
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid)
  );


-- ── Table: order_items ──
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "order_items_tenant_read" ON public.order_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "order_items_service_write" ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: orders ──
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "orders_tenant_read" ON public.orders FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "orders_service_write" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: payment_methods ──
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "pm_tenant_read" ON public.payment_methods FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "pm_service_write" ON public.payment_methods FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: payments ──
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "payments_tenant_read" ON public.payments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE POLICY "payments_service_write" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: stripe_webhook_events ──
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Source: 20260309000000_stripe_webhook_events.sql
create policy "service_role_all" on public.stripe_webhook_events
for all
to public
using (current_setting('app.user_role')::text = 'service_role')
with check (current_setting('app.user_role')::text = 'service_role');


-- ── Table: tiss_glosa_appeals ──
ALTER TABLE public.tiss_glosa_appeals ENABLE ROW LEVEL SECURITY;

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE POLICY "glosa_appeals_select" ON public.tiss_glosa_appeals
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE POLICY "glosa_appeals_insert" ON public.tiss_glosa_appeals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE POLICY "glosa_appeals_update" ON public.tiss_glosa_appeals
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id))
  WITH CHECK (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE POLICY "glosa_appeals_delete" ON public.tiss_glosa_appeals
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));


-- ── Table: tiss_guides ──
ALTER TABLE public.tiss_guides ENABLE ROW LEVEL SECURITY;

-- Source: 20260320110000_tiss_guides.sql
CREATE POLICY "tiss_select" ON public.tiss_guides
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260320110000_tiss_guides.sql
CREATE POLICY "tiss_insert" ON public.tiss_guides
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260320110000_tiss_guides.sql
CREATE POLICY "tiss_update" ON public.tiss_guides
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id))
  WITH CHECK (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

-- Source: 20260320110000_tiss_guides.sql
CREATE POLICY "tiss_delete" ON public.tiss_guides
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));

