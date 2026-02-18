-- Milestone 8 (parte 2): DRE simples + rentabilidade (fonte contábil + CMV por snapshot)

-- RPC: get_dre_simple_v1
-- Fonte:
--  - Receita/Despesas: financial_transactions
--  - CMV (produtos): order_items.total_cost_snapshot para pedidos pagos

create or replace function public.get_dre_simple_v1(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean;

  v_start date;
  v_end date;

  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_cogs numeric := 0;

  v_gross_profit numeric := 0;
  v_net_profit numeric := 0;

  v_gross_margin_pct numeric := null;
  v_net_margin_pct numeric := null;

  v_income_by_category jsonb := '[]'::jsonb;
  v_expense_by_category jsonb := '[]'::jsonb;
  v_cogs_by_product jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  if p_start_date is null or p_end_date is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Informe start_date e end_date');
  end if;

  if p_end_date < p_start_date then
    perform public.raise_app_error('VALIDATION_ERROR', 'end_date deve ser >= start_date');
  end if;

  v_start := p_start_date;
  v_end := p_end_date;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem ver relatórios');
  end if;

  -- Receita
  select coalesce(sum(ft.amount), 0)
    into v_revenue
  from public.financial_transactions ft
  where ft.tenant_id = v_profile.tenant_id
    and ft.type = 'income'
    and ft.transaction_date >= v_start
    and ft.transaction_date <= v_end;

  -- Despesas
  select coalesce(sum(ft.amount), 0)
    into v_expenses
  from public.financial_transactions ft
  where ft.tenant_id = v_profile.tenant_id
    and ft.type = 'expense'
    and ft.transaction_date >= v_start
    and ft.transaction_date <= v_end;

  -- CMV: somar snapshot de custo de itens de produto em pedidos pagos
  -- Usamos a data de pagamento (orders.updated_at) como proxy do checkout.
  select coalesce(sum(oi.total_cost_snapshot), 0)
    into v_cogs
  from public.orders o
  join public.order_items oi
    on oi.order_id = o.id
   and oi.tenant_id = o.tenant_id
  where o.tenant_id = v_profile.tenant_id
    and o.status = 'paid'
    and oi.kind = 'product'
    and oi.total_cost_snapshot is not null
    and (o.updated_at at time zone 'America/Sao_Paulo')::date >= v_start
    and (o.updated_at at time zone 'America/Sao_Paulo')::date <= v_end;

  v_gross_profit := v_revenue - v_cogs;
  v_net_profit := v_revenue - v_cogs - v_expenses;

  if v_revenue > 0 then
    v_gross_margin_pct := round((v_gross_profit / v_revenue) * 100, 2);
    v_net_margin_pct := round((v_net_profit / v_revenue) * 100, 2);
  end if;

  -- Breakdown: receita por categoria
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_income_by_category
  from (
    select ft.category,
           round(sum(ft.amount), 2) as amount
    from public.financial_transactions ft
    where ft.tenant_id = v_profile.tenant_id
      and ft.type = 'income'
      and ft.transaction_date >= v_start
      and ft.transaction_date <= v_end
    group by ft.category
  ) s;

  -- Breakdown: despesa por categoria
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_expense_by_category
  from (
    select ft.category,
           round(sum(ft.amount), 2) as amount
    from public.financial_transactions ft
    where ft.tenant_id = v_profile.tenant_id
      and ft.type = 'expense'
      and ft.transaction_date >= v_start
      and ft.transaction_date <= v_end
    group by ft.category
  ) s;

  -- Breakdown: CMV por produto (top 20)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'product_name', product_name,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_cogs_by_product
  from (
    select oi.product_id,
           max(p.name) as product_name,
           round(sum(oi.total_cost_snapshot), 2) as amount
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
     and oi.tenant_id = o.tenant_id
    join public.products p
      on p.id = oi.product_id
     and p.tenant_id = o.tenant_id
    where o.tenant_id = v_profile.tenant_id
      and o.status = 'paid'
      and oi.kind = 'product'
      and oi.total_cost_snapshot is not null
      and (o.updated_at at time zone 'America/Sao_Paulo')::date >= v_start
      and (o.updated_at at time zone 'America/Sao_Paulo')::date <= v_end
    group by oi.product_id
    order by sum(oi.total_cost_snapshot) desc
    limit 20
  ) s;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'bi_dre_viewed',
    'bi_report',
    null,
    jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    )
  );

  return jsonb_build_object(
    'success', true,
    'start_date', v_start,
    'end_date', v_end,
    'revenue', round(v_revenue, 2),
    'cogs', round(v_cogs, 2),
    'expenses', round(v_expenses, 2),
    'gross_profit', round(v_gross_profit, 2),
    'net_profit', round(v_net_profit, 2),
    'gross_margin_pct', v_gross_margin_pct,
    'net_margin_pct', v_net_margin_pct,
    'income_by_category', v_income_by_category,
    'expense_by_category', v_expense_by_category,
    'cogs_by_product', v_cogs_by_product
  );
end;
$$;

revoke all on function public.get_dre_simple_v1(date, date) from public;
grant execute on function public.get_dre_simple_v1(date, date) to authenticated;
grant execute on function public.get_dre_simple_v1(date, date) to service_role;
