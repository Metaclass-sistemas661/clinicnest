-- Milestone 7: Compras/Fornecedores + Inventário (entrada via compra) + custo médio/auditoria

-- 1) Fornecedores
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_tenant_name
  on public.suppliers(tenant_id, name);

drop trigger if exists update_suppliers_updated_at on public.suppliers;
create trigger update_suppliers_updated_at before update on public.suppliers
for each row execute function public.update_updated_at_column();

alter table public.suppliers enable row level security;

create policy "Users can view suppliers in their tenant"
  on public.suppliers for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Admins can manage suppliers in their tenant"
  on public.suppliers for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id));

revoke all on table public.suppliers from public;

-- 2) Compras
do $$
begin
  create type public.purchase_status as enum ('draft', 'received', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status public.purchase_status not null default 'received',
  purchased_at timestamptz not null default now(),
  invoice_number text,
  notes text,
  purchased_with_company_cash boolean not null default false,
  total_amount numeric not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_tenant_date
  on public.purchases(tenant_id, purchased_at desc);
create index if not exists idx_purchase_items_purchase
  on public.purchase_items(purchase_id);

-- updated_at triggers

drop trigger if exists update_purchases_updated_at on public.purchases;
create trigger update_purchases_updated_at before update on public.purchases
for each row execute function public.update_updated_at_column();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

create policy "Users can view purchases in their tenant"
  on public.purchases for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Admins can manage purchases in their tenant"
  on public.purchases for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id));

create policy "Users can view purchase items in their tenant"
  on public.purchase_items for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Admins can manage purchase items in their tenant"
  on public.purchase_items for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()) and public.is_tenant_admin(auth.uid(), tenant_id));

revoke all on table public.purchases from public;
revoke all on table public.purchase_items from public;

-- 3) RPC: registrar compra recebida + entrada no estoque + custo médio + auditoria
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

    v_line_total := round(v_unit_cost * v_qty, 2);
    v_total := v_total + v_line_total;

    insert into public.purchase_items(
      tenant_id, purchase_id, product_id, quantity, unit_cost, line_total
    ) values (
      v_profile.tenant_id, v_purchase_id, v_product.id, v_qty, v_unit_cost, v_line_total
    );

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

    perform public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'purchase_item_received',
      'product',
      v_product.id::text,
      jsonb_build_object(
        'purchase_id', v_purchase_id::text,
        'movement_id', v_movement_id::text,
        'quantity_in', v_qty,
        'unit_cost', v_unit_cost,
        'prev_cost', v_product.cost,
        'new_cost', v_new_cost,
        'prev_quantity', v_product.quantity,
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

revoke all on function public.create_purchase_v1(uuid, timestamptz, text, text, boolean, jsonb) from public;
grant execute on function public.create_purchase_v1(uuid, timestamptz, text, text, boolean, jsonb) to authenticated;
grant execute on function public.create_purchase_v1(uuid, timestamptz, text, text, boolean, jsonb) to service_role;
