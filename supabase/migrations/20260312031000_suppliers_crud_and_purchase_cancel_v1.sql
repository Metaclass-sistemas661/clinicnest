-- Milestone 7: CRUD de fornecedores + cancelamento/estorno de compras (seguro com snapshot)

-- 1) Ajustes de schema

alter table public.purchases
  add column if not exists financial_transaction_id uuid references public.financial_transactions(id) on delete set null;

alter table public.purchases
  add column if not exists cancelled_at timestamptz;

alter table public.purchases
  add column if not exists cancelled_by uuid;

alter table public.purchases
  add column if not exists cancel_reason text;

alter table public.purchase_items
  add column if not exists prev_quantity integer;

alter table public.purchase_items
  add column if not exists prev_cost numeric;

alter table public.purchase_items
  add column if not exists stock_movement_id uuid references public.stock_movements(id) on delete set null;

create index if not exists idx_purchase_items_purchase_product
  on public.purchase_items(purchase_id, product_id);

create index if not exists idx_purchases_tenant_status_date
  on public.purchases(tenant_id, status, purchased_at desc);


-- 2) Patch create_purchase_v1: salvar snapshot e vincular lançamentos/estoque

create or replace function public.create_purchase_v1(
  p_supplier_id uuid default null,
  p_purchased_at timestamptz default null,
  p_invoice_number text default null,
  p_notes text default null,
  p_purchased_with_company_cash boolean default false,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;

  v_purchase_id uuid;
  v_total numeric := 0;

  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_unit_cost numeric;
  v_line_total numeric;
  v_signed_qty integer;
  v_new_qty integer;
  v_new_cost numeric;

  v_movement_id uuid;
  v_tx_id uuid;
  v_description text;
  v_purchased_at timestamptz;
  v_prev_qty integer;
  v_prev_cost numeric;
  v_item_id uuid;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem registrar compras');
  end if;

  v_purchased_at := coalesce(p_purchased_at, now());

  if p_supplier_id is not null then
    if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.tenant_id = v_profile.tenant_id) then
      perform public.raise_app_error('NOT_FOUND', 'Fornecedor não encontrado');
    end if;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    perform public.raise_app_error('VALIDATION_ERROR', 'items deve ser um array');
  end if;

  insert into public.purchases(
    tenant_id, supplier_id, status, purchased_at, invoice_number, notes, purchased_with_company_cash, total_amount, created_by
  ) values (
    v_profile.tenant_id,
    p_supplier_id,
    'received',
    v_purchased_at,
    nullif(btrim(p_invoice_number), ''),
    nullif(btrim(p_notes), ''),
    coalesce(p_purchased_with_company_cash, false),
    0,
    v_user_id
  ) returning id into v_purchase_id;

  -- Processar itens
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := nullif((v_item->>'quantity')::int, 0);
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      perform public.raise_app_error('VALIDATION_ERROR', 'Quantidade inválida em item');
    end if;

    if v_unit_cost < 0 then
      perform public.raise_app_error('VALIDATION_ERROR', 'unit_cost inválido em item');
    end if;

    perform pg_advisory_xact_lock(hashtext((v_item->>'product_id')::text), hashtext('purchase_item'));

    select * into v_product
    from public.products pr
    where pr.id = (v_item->>'product_id')::uuid
      and pr.tenant_id = v_profile.tenant_id
    for update;

    if not found then
      perform public.raise_app_error('NOT_FOUND', 'Produto não encontrado em item');
    end if;

    v_prev_qty := v_product.quantity;
    v_prev_cost := v_product.cost;

    v_line_total := round(v_unit_cost * v_qty, 2);
    v_total := v_total + v_line_total;

    -- Custo médio ponderado
    v_signed_qty := v_qty;
    v_new_qty := v_product.quantity + v_signed_qty;

    if v_new_qty <= 0 then
      v_new_cost := v_unit_cost;
    else
      v_new_cost := (coalesce(v_product.cost, 0) * greatest(v_product.quantity, 0) + (v_unit_cost * v_qty)) / v_new_qty;
    end if;

    v_new_cost := round(v_new_cost, 4);

    insert into public.stock_movements(
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) values (
      v_profile.tenant_id,
      v_product.id,
      v_signed_qty,
      'in',
      null,
      'Entrada via compra ' || v_purchase_id::text,
      v_profile.id
    ) returning id into v_movement_id;

    update public.products
      set quantity = v_new_qty,
          cost = v_new_cost,
          updated_at = now()
    where id = v_product.id
      and tenant_id = v_profile.tenant_id;

    insert into public.purchase_items(
      tenant_id, purchase_id, product_id, quantity, unit_cost, line_total, prev_quantity, prev_cost, stock_movement_id
    ) values (
      v_profile.tenant_id, v_purchase_id, v_product.id, v_qty, v_unit_cost, v_line_total, v_prev_qty, v_prev_cost, v_movement_id
    ) returning id into v_item_id;

    perform public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'purchase_item_received',
      'product',
      v_product.id::text,
      jsonb_build_object(
        'purchase_id', v_purchase_id::text,
        'purchase_item_id', v_item_id::text,
        'movement_id', v_movement_id::text,
        'quantity_in', v_qty,
        'unit_cost', v_unit_cost,
        'prev_cost', v_prev_cost,
        'new_cost', v_new_cost,
        'prev_quantity', v_prev_qty,
        'new_quantity', v_new_qty
      )
    );
  end loop;

  update public.purchases
    set total_amount = v_total,
        updated_at = now()
  where id = v_purchase_id
    and tenant_id = v_profile.tenant_id;

  -- Financeiro: registrar despesa total, se marcado
  if coalesce(p_purchased_with_company_cash, false) is true then
    v_description := 'Compra (entrada de estoque)';
    if p_invoice_number is not null and btrim(p_invoice_number) <> '' then
      v_description := v_description || ' · NF ' || btrim(p_invoice_number);
    end if;

    insert into public.financial_transactions(
      tenant_id, type, category, amount, description, transaction_date
    ) values (
      v_profile.tenant_id,
      'expense',
      'Produtos',
      v_total,
      v_description,
      (v_purchased_at at time zone 'UTC')::date
    ) returning id into v_tx_id;

    update public.purchases
      set financial_transaction_id = v_tx_id,
          updated_at = now()
    where id = v_purchase_id
      and tenant_id = v_profile.tenant_id;
  end if;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'purchase_created',
    'purchase',
    v_purchase_id::text,
    jsonb_build_object(
      'supplier_id', case when p_supplier_id is null then null else p_supplier_id::text end,
      'purchased_at', v_purchased_at,
      'invoice_number', nullif(btrim(p_invoice_number), ''),
      'total_amount', v_total,
      'purchased_with_company_cash', coalesce(p_purchased_with_company_cash, false),
      'financial_transaction_id', case when v_tx_id is null then null else v_tx_id::text end
    )
  );

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'total_amount', v_total,
    'financial_transaction_id', v_tx_id
  );
end;
$$;


-- 3) RPC: cancelar/estornar compra (somente se não houve movimentos após a compra)

create or replace function public.cancel_purchase_v1(
  p_purchase_id uuid,
  p_reason text default null
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

  v_purchase public.purchases%rowtype;
  v_item public.purchase_items%rowtype;
  v_product public.products%rowtype;

  v_inbound_created_at timestamptz;

  v_conflict boolean;
  v_new_tx_id uuid;
  v_desc text;
  v_out_movement_id uuid;
  v_already_cancelled boolean := false;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem cancelar compras');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_purchase_id::text), hashtext('cancel_purchase'));

  select * into v_purchase
  from public.purchases pu
  where pu.id = p_purchase_id
    and pu.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Compra não encontrada');
  end if;

  if v_purchase.status = 'cancelled' then
    v_already_cancelled := true;
  end if;

  -- Validar possibilidade de estorno (sem movimentos após a compra)
  for v_item in
    select * from public.purchase_items it
    where it.purchase_id = v_purchase.id
      and it.tenant_id = v_profile.tenant_id
  loop
    if v_item.stock_movement_id is null or v_item.prev_quantity is null then
      perform public.raise_app_error('VALIDATION_ERROR', 'Não é possível cancelar: compra antiga sem snapshot de estoque');
    end if;

    select sm.created_at into v_inbound_created_at
    from public.stock_movements sm
    where sm.id = v_item.stock_movement_id
      and sm.tenant_id = v_profile.tenant_id
    limit 1;

    if v_inbound_created_at is null then
      perform public.raise_app_error('VALIDATION_ERROR', 'Não é possível cancelar: movimentação de entrada não encontrada');
    end if;

    -- Se existir qualquer movimento de estoque para o produto após a entrada desta compra, não estornar
    select exists (
      select 1
      from public.stock_movements sm
      where sm.tenant_id = v_profile.tenant_id
        and sm.product_id = v_item.product_id
        and sm.created_at > v_inbound_created_at
        and sm.id <> v_item.stock_movement_id
    ) into v_conflict;

    if v_conflict then
      perform public.raise_app_error('CONFLICT', 'Não é possível cancelar: houve movimentações de estoque após esta compra');
    end if;
  end loop;

  if v_already_cancelled then
    return jsonb_build_object('success', true, 'already_cancelled', true, 'purchase_id', v_purchase.id);
  end if;

  -- Estornar itens (reverter snapshot e criar movimento out)
  for v_item in
    select * from public.purchase_items it
    where it.purchase_id = v_purchase.id
      and it.tenant_id = v_profile.tenant_id
    order by it.created_at asc
  loop
    perform pg_advisory_xact_lock(hashtext(v_item.product_id::text), hashtext('cancel_purchase_item'));

    select * into v_product
    from public.products pr
    where pr.id = v_item.product_id
      and pr.tenant_id = v_profile.tenant_id
    for update;

    if not found then
      perform public.raise_app_error('NOT_FOUND', 'Produto não encontrado no estorno');
    end if;

    insert into public.stock_movements(
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) values (
      v_profile.tenant_id,
      v_item.product_id,
      -abs(v_item.quantity),
      'out',
      null,
      'Estorno compra ' || v_purchase.id::text,
      v_profile.id
    ) returning id into v_out_movement_id;

    update public.products
      set quantity = v_item.prev_quantity,
          cost = v_item.prev_cost,
          updated_at = now()
    where id = v_item.product_id
      and tenant_id = v_profile.tenant_id;

    perform public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'purchase_item_cancelled',
      'product',
      v_item.product_id::text,
      jsonb_build_object(
        'purchase_id', v_purchase.id::text,
        'purchase_item_id', v_item.id::text,
        'movement_id', v_out_movement_id::text,
        'reverted_to_quantity', v_item.prev_quantity,
        'reverted_to_cost', v_item.prev_cost
      )
    );
  end loop;

  -- Financeiro: estornar a despesa (se existiu) via lançamento income
  if v_purchase.financial_transaction_id is not null then
    v_desc := 'Estorno de compra';
    if v_purchase.invoice_number is not null and btrim(v_purchase.invoice_number) <> '' then
      v_desc := v_desc || ' · NF ' || btrim(v_purchase.invoice_number);
    end if;

    insert into public.financial_transactions(
      tenant_id, type, category, amount, description, transaction_date
    ) values (
      v_profile.tenant_id,
      'income',
      'Produtos',
      v_purchase.total_amount,
      v_desc,
      (now() at time zone 'UTC')::date
    ) returning id into v_new_tx_id;
  end if;

  update public.purchases
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = v_user_id,
        cancel_reason = nullif(btrim(p_reason), ''),
        notes = case
          when p_reason is null or btrim(p_reason) = '' then notes
          else coalesce(notes, '') || '\nCancelamento: ' || p_reason
        end,
        updated_at = now()
  where id = v_purchase.id
    and tenant_id = v_profile.tenant_id;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'purchase_cancelled',
    'purchase',
    v_purchase.id::text,
    jsonb_build_object(
      'reason', nullif(btrim(p_reason), ''),
      'reversal_financial_transaction_id', case when v_new_tx_id is null then null else v_new_tx_id::text end
    )
  );

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'reversal_financial_transaction_id', v_new_tx_id
  );
end;
$$;

revoke all on function public.cancel_purchase_v1(uuid, text) from public;
grant execute on function public.cancel_purchase_v1(uuid, text) to authenticated;
grant execute on function public.cancel_purchase_v1(uuid, text) to service_role;
