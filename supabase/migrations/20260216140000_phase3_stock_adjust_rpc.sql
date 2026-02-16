-- Phase 3: Stock adjustments as a single transaction (RPC)

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_out_reason_type text default null,
  p_reason text default null,
  p_purchased_with_company_cash boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_signed_qty integer;
  v_new_qty integer;
  v_amount numeric;
  v_tx_id uuid;
  v_movement_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade inválida';
  end if;

  if p_movement_type not in ('in', 'out') then
    raise exception 'movement_type inválido';
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;

  if not public.is_tenant_admin(v_user_id, v_profile.tenant_id) then
    raise exception 'Apenas admin pode ajustar estoque';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_product_id::text), hashtext('adjust_stock'));

  select * into v_product
  from public.products pr
  where pr.id = p_product_id
    and pr.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_signed_qty := case when p_movement_type = 'in' then p_quantity else -p_quantity end;
  v_new_qty := v_product.quantity + v_signed_qty;

  if v_new_qty < 0 then
    raise exception 'Estoque insuficiente';
  end if;

  insert into public.stock_movements (
    tenant_id,
    product_id,
    quantity,
    movement_type,
    out_reason_type,
    reason,
    created_by
  ) values (
    v_profile.tenant_id,
    v_product.id,
    v_signed_qty,
    p_movement_type,
    case when p_movement_type = 'out' then nullif(p_out_reason_type, '') else null end,
    p_reason,
    v_profile.id
  ) returning id into v_movement_id;

  update public.products
    set quantity = v_new_qty,
        updated_at = now()
  where id = v_product.id
    and tenant_id = v_profile.tenant_id;

  -- If it's an inbound movement bought with company cash, register an expense.
  if p_movement_type = 'in' and p_purchased_with_company_cash is true then
    v_amount := coalesce(v_product.cost, 0) * p_quantity;
    insert into public.financial_transactions (
      tenant_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      product_id
    ) values (
      v_profile.tenant_id,
      'expense',
      'Produtos',
      v_amount,
      'Compra de produto (entrada de estoque) - ' || coalesce(v_product.name, 'Produto'),
      current_date,
      v_product.id
    ) returning id into v_tx_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'product_id', v_product.id,
    'movement_id', v_movement_id,
    'financial_transaction_id', v_tx_id,
    'new_quantity', v_new_qty
  );
end;
$$;

revoke all on function public.adjust_stock(uuid, text, integer, text, text, boolean) from public;
grant execute on function public.adjust_stock(uuid, text, integer, text, text, boolean) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text, text, boolean) to service_role;
