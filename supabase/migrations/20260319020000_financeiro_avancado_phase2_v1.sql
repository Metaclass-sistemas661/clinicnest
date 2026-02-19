-- FASE 2: Financeiro Avançado
-- 2.1 Contas a Pagar  | 2.2 Contas a Receber
-- 2.3 Fluxo de Caixa  | 2.5 Centro de Custo

-- ─── 1) Centro de Custo ──────────────────────────────────────
create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cost_centers_tenant
  on public.cost_centers(tenant_id);

alter table public.cost_centers enable row level security;

drop policy if exists "Admins can manage cost centers" on public.cost_centers;
create policy "Admins can manage cost centers"
  on public.cost_centers for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  )
  with check (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

-- Seed default cost centers (idempotent)
insert into public.cost_centers(tenant_id, name, color)
select t.id, s.name, s.color
from public.tenants t
cross join (values
  ('Operacional', '#6366f1'),
  ('Marketing', '#ec4899'),
  ('Pessoal', '#f59e0b'),
  ('Infraestrutura', '#10b981'),
  ('Outros', '#94a3b8')
) as s(name, color)
where not exists (
  select 1 from public.cost_centers cc
  where cc.tenant_id = t.id
);

-- ─── 2) Contas a Pagar ───────────────────────────────────────
create table if not exists public.bills_payable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  category text not null default 'Outros',
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  status text not null default 'pending',
  is_recurring boolean not null default false,
  recurrence_type text,
  notes text,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bills_payable_status_check check (status in ('pending','paid','cancelled')),
  constraint bills_payable_recurrence_check check (
    recurrence_type is null or recurrence_type in ('weekly','monthly','yearly')
  )
);

create index if not exists idx_bills_payable_tenant_due
  on public.bills_payable(tenant_id, due_date);

create index if not exists idx_bills_payable_tenant_status
  on public.bills_payable(tenant_id, status);

alter table public.bills_payable enable row level security;

drop policy if exists "Admins can manage bills payable" on public.bills_payable;
create policy "Admins can manage bills payable"
  on public.bills_payable for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  )
  with check (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

-- ─── 3) Contas a Receber ─────────────────────────────────────
create table if not exists public.bills_receivable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  category text not null default 'Outros',
  status text not null default 'pending',
  notes text,
  received_at timestamptz,
  received_amount numeric(12,2),
  payment_method text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bills_receivable_status_check check (status in ('pending','received','cancelled'))
);

create index if not exists idx_bills_receivable_tenant_due
  on public.bills_receivable(tenant_id, due_date);

create index if not exists idx_bills_receivable_tenant_status
  on public.bills_receivable(tenant_id, status);

alter table public.bills_receivable enable row level security;

drop policy if exists "Admins can manage bills receivable" on public.bills_receivable;
create policy "Admins can manage bills receivable"
  on public.bills_receivable for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  )
  with check (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

-- ─── 4) Cash Flow Projection RPC ─────────────────────────────
-- Returns day-by-day projected cash flow combining:
--   • actual financial_transactions (past + today)
--   • future bills_payable (pending, due in window)
--   • future bills_receivable (pending, due in window)
create or replace function public.get_cash_flow_projection_v1(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_end_date date;

  v_actual_balance numeric := 0;
  v_projected_payable numeric := 0;
  v_projected_receivable numeric := 0;

  v_series jsonb := '[]'::jsonb;
  v_day date;
  v_running numeric := 0;
  v_day_income numeric;
  v_day_expense numeric;
  v_day_payable numeric;
  v_day_receivable numeric;
  v_pending_payable numeric;
  v_pending_receivable numeric;
begin
  v_tenant_id := public.get_user_tenant_id(auth.uid());

  if v_tenant_id is null then
    raise exception 'Tenant não encontrado';
  end if;

  if not public.is_tenant_admin(auth.uid(), v_tenant_id) then
    raise exception 'Sem permissão';
  end if;

  p_days := least(greatest(coalesce(p_days, 30), 7), 180);
  v_end_date := v_today + p_days;

  -- Opening balance: sum of all financial transactions up to yesterday
  select coalesce(
    sum(case when type = 'income' then amount else -amount end), 0
  ) into v_actual_balance
  from public.financial_transactions
  where tenant_id = v_tenant_id
    and transaction_date < v_today;

  -- Pending payable total in window
  select coalesce(sum(amount), 0) into v_projected_payable
  from public.bills_payable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date between v_today and v_end_date;

  -- Pending receivable total in window
  select coalesce(sum(amount), 0) into v_projected_receivable
  from public.bills_receivable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date between v_today and v_end_date;

  -- Build day-by-day series
  v_running := v_actual_balance;
  v_day := v_today - 7; -- include 7 days of history

  while v_day <= v_end_date loop
    -- Actual income/expense for this day
    select
      coalesce(sum(case when type='income' then amount else 0 end),0),
      coalesce(sum(case when type='expense' then amount else 0 end),0)
    into v_day_income, v_day_expense
    from public.financial_transactions
    where tenant_id = v_tenant_id
      and transaction_date = v_day;

    -- Projected payable for this day
    select coalesce(sum(amount),0) into v_day_payable
    from public.bills_payable
    where tenant_id = v_tenant_id
      and status = 'pending'
      and due_date = v_day;

    -- Projected receivable for this day
    select coalesce(sum(amount),0) into v_day_receivable
    from public.bills_receivable
    where tenant_id = v_tenant_id
      and status = 'pending'
      and due_date = v_day;

    v_running := v_running + v_day_income - v_day_expense;

    v_series := v_series || jsonb_build_object(
      'date', v_day::text,
      'actual_income', (v_day_income)::float,
      'actual_expense', (v_day_expense)::float,
      'projected_payable', (v_day_payable)::float,
      'projected_receivable', (v_day_receivable)::float,
      'running_balance', (v_running)::float,
      'is_past', v_day < v_today
    );

    v_day := v_day + 1;
  end loop;

  -- Pending bills outside window (overdue)
  select coalesce(sum(amount),0) into v_pending_payable
  from public.bills_payable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date < v_today;

  select coalesce(sum(amount),0) into v_pending_receivable
  from public.bills_receivable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date < v_today;

  return jsonb_build_object(
    'success', true,
    'days', p_days,
    'today', v_today::text,
    'opening_balance', (v_actual_balance)::float,
    'projected_payable_window', (v_projected_payable)::float,
    'projected_receivable_window', (v_projected_receivable)::float,
    'overdue_payable', (v_pending_payable)::float,
    'overdue_receivable', (v_pending_receivable)::float,
    'series', v_series
  );
end;
$$;

revoke all on function public.get_cash_flow_projection_v1(integer) from public;
grant execute on function public.get_cash_flow_projection_v1(integer) to authenticated;
grant execute on function public.get_cash_flow_projection_v1(integer) to service_role;

-- ─── 5) Updated_at trigger for both tables ───────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bills_payable_updated_at on public.bills_payable;
create trigger trg_bills_payable_updated_at
  before update on public.bills_payable
  for each row execute function public.set_updated_at();

drop trigger if exists trg_bills_receivable_updated_at on public.bills_receivable;
create trigger trg_bills_receivable_updated_at
  before update on public.bills_receivable
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cost_centers_updated_at on public.cost_centers;
create trigger trg_cost_centers_updated_at
  before update on public.cost_centers
  for each row execute function public.set_updated_at();
