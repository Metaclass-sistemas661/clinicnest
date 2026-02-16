-- P2.3: Minimal smoke tests (manual) for RLS/RPC behavior
-- Run these in Supabase SQL Editor while authenticated as a test user where possible.
-- Notes:
-- - Some tests require auth context (auth.uid()) so they must be executed from a client session.
-- - This file provides helper queries/checks and documentation-level SQL.

-- 1) Verify RPCs exist
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'raise_app_error',
    'create_appointment_v2',
    'update_appointment_v2',
    'delete_appointment_v2',
    'create_financial_transaction_v2',
    'create_product_v2',
    'get_my_context',
    'cancel_appointment',
    'adjust_stock',
    'mark_commission_paid'
  )
order by proname;

-- 2) Verify audit trigger exists
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname in ('trg_audit_appointment_completion_summary_insert');

-- 3) Spot-check audit logs volume by action (tenant scoped)
-- (As admin) replace <TENANT_ID>
-- select action, count(*) from public.audit_logs where tenant_id = '<TENANT_ID>' group by 1 order by 2 desc;

-- 4) Checklist (manual in app)
-- - Create appointment and attempt conflicting slot => should return DETAIL=SLOT_CONFLICT
-- - Confirm appointment then try edit fields other than notes => should error / lock
-- - Staff delete pending own => ok; staff delete confirmed => should error DETAIL=APPOINTMENT_DELETE_PENDING_ONLY
-- - Delete completed => should error DETAIL=APPOINTMENT_DELETE_COMPLETED_FORBIDDEN
-- - Create product (with purchased_with_company_cash) => should create optional expense and audit log product_created
