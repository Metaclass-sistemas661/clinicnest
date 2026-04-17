CREATE OR REPLACE FUNCTION public.get_cash_flow_projection_v1(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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

  v_tenant_id := public.get_user_tenant_id(current_setting('app.current_user_id')::uuid);



  if v_tenant_id is null then

    raise exception 'Tenant n├úo encontrado';

  end if;



  if not public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id) then

    raise exception 'Sem permiss├úo';

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

$function$;