-- P10: Security regression suite (manual)
-- Goal: quick evidence that multi-tenant hardening is still in place.
-- This is designed for *manual execution* in Supabase SQL editor and/or local SQL tooling.
-- Some steps require running queries as different roles/users.

-- =========================
-- A) STRUCTURE CHECKS
-- =========================

-- A1) RLS must be enabled on critical tables
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'appointments',
    'clients',
    'services',
    'products',
    'product_categories',
    'stock_movements',
    'financial_transactions',
    'commission_payments',
    'goals',
    'goal_templates',
    'audit_logs',
    'appointment_completion_summaries'
  )
order by 1;

-- A2) Write-guard triggers must exist (RPC-only writes)
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname like 'trg_enforce_rpc_only_writes_%'
order by tgrelid::regclass::text, tgname;

-- A3) Key RPCs must exist
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'raise_app_error',
    'enforce_rpc_only_writes',
    'get_my_context',
    'create_appointment_v2',
    'update_appointment_v2',
    'set_appointment_status_v2',
    'delete_appointment_v2',
    'create_financial_transaction_v2',
    'create_product_v2',
    'update_product_prices_v2',
    'create_product_category_v2',
    'adjust_stock',
    'cancel_appointment',
    'mark_commission_paid',
    'upsert_service_v2',
    'set_service_active_v2',
    'upsert_client_v2',
    'create_goal_v2',
    'update_goal_v2',
    'archive_goal_v2',
    'create_goal_template_v2'
  )
order by proname;

-- A4) Audit indexes must exist (optional but recommended)
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_audit_logs_tenant_created_at',
    'idx_audit_logs_tenant_action_created_at',
    'idx_audit_logs_tenant_entity_created_at'
  )
order by tablename, indexname;


-- =========================
-- B) NEGATIVE TESTS (DENY)
-- =========================
-- These require executing as a real app user (authenticated) via client/app,
-- because SQL editor usually runs as an admin role.
-- The expected errors should carry DETAIL codes (raise_app_error) where applicable.

-- B1) Direct write should be blocked (expected DETAIL=DIRECT_WRITE_FORBIDDEN)
-- Try from client session:
-- insert into public.clients(tenant_id, name) values ('<TENANT_ID>', 'X');
-- update public.products set sale_price = sale_price where tenant_id = '<TENANT_ID>';
-- delete from public.services where tenant_id = '<TENANT_ID>';

-- B2) Staff should not be able to read audit logs (expected RLS deny)
-- From a STAFF account in the app/devtools:
-- supabase.from('audit_logs').select('*').limit(1)

-- B3) Cross-tenant read should not leak
-- With two tenants (A and B), sign in as tenant A user and attempt:
-- supabase.from('clients').select('*').eq('tenant_id','<TENANT_B>')
-- Expect: empty set (RLS)


-- =========================
-- C) POSITIVE TESTS (ALLOW)
-- =========================

-- C1) Admin can read audit logs (should return rows)
-- From ADMIN app session:
-- supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(5)

-- C2) RPC creates audit entries
-- Create/Update Service/Client/Goal and confirm audit
-- select action, entity_type, created_at from public.audit_logs where tenant_id = '<TENANT_ID>' order by created_at desc limit 20;

-- C3) Error codes are machine-readable (DETAIL)
-- Trigger slot conflict in Agenda => details = SLOT_CONFLICT
-- Staff delete confirmed appointment => details = APPOINTMENT_DELETE_PENDING_ONLY
