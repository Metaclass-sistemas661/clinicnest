-- P12: FORCE RLS + GRANT hardening
-- Goal: defense-in-depth for multi-tenant isolation.

-- 1) FORCE RLS on critical tables
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goal_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_completion_summaries FORCE ROW LEVEL SECURITY;

-- 2) GRANT hardening: remove direct DML for app roles on RPC-only tables
-- Reads (SELECT) remain controlled by RLS policies.
REVOKE INSERT, UPDATE, DELETE ON public.appointments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.clients FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.services FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_categories FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.financial_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.commission_payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.goals FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.goal_templates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appointment_completion_summaries FROM anon, authenticated;
