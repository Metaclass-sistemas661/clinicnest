-- RLS / Policies audit checklist
-- Safe to run multiple times.

-- 1) Tables without RLS enabled (excluding system schemas)
create or replace view public.audit_tables_without_rls as
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_%'
  and c.relname not like 'supabase_%'
  and c.relrowsecurity is false
order by 1, 2;

-- 2) Tables with RLS enabled but no policies
create or replace view public.audit_rls_tables_without_policies as
with rls_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    and n.nspname not like 'pg_%'
    and c.relname not like 'supabase_%'
    and c.relrowsecurity is true
)
select
  t.schema_name,
  t.table_name
from rls_tables t
left join pg_policy p on p.polrelid = t.oid
where p.oid is null
order by 1, 2;

-- 3) Potentially dangerous policies (USING true / WITH CHECK true)
create or replace view public.audit_policies_permissive as
select
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
    else p.polcmd::text
  end as command,
  pg_get_expr(p.polqual, p.polrelid) as using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_%'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') in ('true', '(true)')
    or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') in ('true', '(true)')
  )
order by 1, 2, 3;

-- 4) Public tables without tenant_id column (heuristic)
-- This is a heuristic: it flags tables that look tenant-scoped but lack tenant_id.
create or replace view public.audit_public_tables_missing_tenant_id as
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname not in (
    'tenants',
    'subscriptions',
    'contact_messages',
    'lgpd_requests',
    'lgpd_consent',
    'admin_audit_logs'
  )
  and not exists (
    select 1
    from information_schema.columns col
    where col.table_schema = n.nspname
      and col.table_name = c.relname
      and col.column_name = 'tenant_id'
  )
order by 1, 2;

-- Usage:
-- select * from public.audit_tables_without_rls;
-- select * from public.audit_rls_tables_without_policies;
-- select * from public.audit_policies_permissive;
-- select * from public.audit_public_tables_missing_tenant_id;
