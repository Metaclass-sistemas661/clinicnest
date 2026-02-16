-- P8: Ops checklist (manual) - validate hardening after deploy

-- 1) Verify write-guard triggers exist
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname like 'trg_enforce_rpc_only_writes_%'
order by tgrelid::regclass::text, tgname;

-- 2) Verify key RPCs exist
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'raise_app_error',
    'enforce_rpc_only_writes',
    'create_appointment_v2',
    'update_appointment_v2',
    'set_appointment_status_v2',
    'delete_appointment_v2',
    'create_financial_transaction_v2',
    'create_product_v2',
    'adjust_stock',
    'mark_commission_paid',
    'cancel_appointment',
    'get_my_context',
    'upsert_service_v2',
    'set_service_active_v2',
    'upsert_client_v2',
    'create_goal_v2',
    'update_goal_v2',
    'archive_goal_v2',
    'create_goal_template_v2',
    'create_product_category_v2',
    'update_product_prices_v2'
  )
order by proname;

-- 3) Verify indexes exist (performance)
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_appointments_tenant_scheduled_at',
    'idx_appointments_tenant_professional_scheduled_at',
    'idx_appointments_tenant_professional_scheduled_at_not_cancelled',
    'idx_financial_transactions_tenant_transaction_date',
    'idx_financial_transactions_tenant_type_date',
    'idx_stock_movements_tenant_created_at',
    'idx_stock_movements_tenant_product_created_at',
    'idx_stock_movements_tenant_out_reason_created_at'
  )
order by tablename, indexname;

-- 4) Audit logs quick stats (replace <TENANT_ID>)
-- select action, count(*) from public.audit_logs where tenant_id = '<TENANT_ID>' group by 1 order by 2 desc;

-- 5) Manual app smoke test expectations
-- - Any direct writes to guarded tables should fail with DETAIL=DIRECT_WRITE_FORBIDDEN
-- - Conflict scheduling should fail with DETAIL=SLOT_CONFLICT
-- - Forbidden actions should fail with DETAIL=FORBIDDEN
