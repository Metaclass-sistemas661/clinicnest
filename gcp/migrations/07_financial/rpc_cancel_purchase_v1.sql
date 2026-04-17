CREATE OR REPLACE FUNCTION public.cancel_purchase_v1(p_purchase_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

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

    perform public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  end if;



  select * into v_profile

  from public.profiles p

  where p.user_id = v_user_id

  limit 1;



  if not found then

    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

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

    perform public.raise_app_error('NOT_FOUND', 'Compra n├úo encontrada');

  end if;



  if v_purchase.status = 'cancelled' then

    v_already_cancelled := true;

  end if;



  -- Validar possibilidade de estorno (sem movimentos ap├│s a compra)

  for v_item in

    select * from public.purchase_items it

    where it.purchase_id = v_purchase.id

      and it.tenant_id = v_profile.tenant_id

  loop

    if v_item.stock_movement_id is null or v_item.prev_quantity is null then

      perform public.raise_app_error('VALIDATION_ERROR', 'N├úo ├® poss├¡vel cancelar: compra antiga sem snapshot de estoque');

    end if;



    select sm.created_at into v_inbound_created_at

    from public.stock_movements sm

    where sm.id = v_item.stock_movement_id

      and sm.tenant_id = v_profile.tenant_id

    limit 1;



    if v_inbound_created_at is null then

      perform public.raise_app_error('VALIDATION_ERROR', 'N├úo ├® poss├¡vel cancelar: movimenta├º├úo de entrada n├úo encontrada');

    end if;



    -- Se existir qualquer movimento de estoque para o produto ap├│s a entrada desta compra, n├úo estornar

    select exists (

      select 1

      from public.stock_movements sm

      where sm.tenant_id = v_profile.tenant_id

        and sm.product_id = v_item.product_id

        and sm.created_at > v_inbound_created_at

        and sm.id <> v_item.stock_movement_id

    ) into v_conflict;



    if v_conflict then

      perform public.raise_app_error('CONFLICT', 'N├úo ├® poss├¡vel cancelar: houve movimenta├º├Áes de estoque ap├│s esta compra');

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

      perform public.raise_app_error('NOT_FOUND', 'Produto n├úo encontrado no estorno');

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



  -- Financeiro: estornar a despesa (se existiu) via lan├ºamento income

  if v_purchase.financial_transaction_id is not null then

    v_desc := 'Estorno de compra';

    if v_purchase.invoice_number is not null and btrim(v_purchase.invoice_number) <> '' then

      v_desc := v_desc || ' ┬À NF ' || btrim(v_purchase.invoice_number);

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

$function$;