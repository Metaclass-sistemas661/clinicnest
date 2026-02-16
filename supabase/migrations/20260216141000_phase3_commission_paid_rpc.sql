-- Phase 3: Commission payment hardening (idempotent + proper financial link)

alter table public.financial_transactions
  add column if not exists commission_payment_id uuid references public.commission_payments(id) on delete set null;

create unique index if not exists financial_transactions_commission_payment_unique
  on public.financial_transactions(commission_payment_id)
  where commission_payment_id is not null;

create or replace function public.mark_commission_paid(
  p_commission_payment_id uuid,
  p_payment_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.commission_payments%rowtype;
  v_paid boolean;
  v_payment_date date;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_payment_date := coalesce(p_payment_date, current_date);

  perform pg_advisory_xact_lock(hashtext(p_commission_payment_id::text), hashtext('mark_commission_paid'));

  select * into v_row
  from public.commission_payments cp
  where cp.id = p_commission_payment_id
  for update;

  if not found then
    raise exception 'Comissão não encontrada';
  end if;

  if not public.is_tenant_admin(v_user_id, v_row.tenant_id) then
    raise exception 'Apenas admin pode pagar comissão';
  end if;

  v_paid := (v_row.status = 'paid');
  if v_paid then
    return jsonb_build_object('success', true, 'already_paid', true, 'commission_payment_id', v_row.id);
  end if;

  if v_row.status = 'cancelled' then
    raise exception 'Comissão cancelada não pode ser paga';
  end if;

  update public.commission_payments
    set status = 'paid',
        payment_date = v_payment_date,
        paid_by = v_user_id,
        updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('success', true, 'already_paid', false, 'commission_payment_id', v_row.id);
end;
$$;

revoke all on function public.mark_commission_paid(uuid, date) from public;
grant execute on function public.mark_commission_paid(uuid, date) to authenticated;
grant execute on function public.mark_commission_paid(uuid, date) to service_role;

-- Replace trigger function to be deterministic and idempotent.
create or replace function public.create_expense_on_commission_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    v_desc := 'Comissão - ' || coalesce(
      (select full_name from public.profiles where user_id = new.professional_id limit 1),
      'Profissional'
    );

    insert into public.financial_transactions (
      tenant_id,
      appointment_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      commission_payment_id
    ) values (
      new.tenant_id,
      new.appointment_id,
      'expense',
      'Funcionários',
      new.amount,
      v_desc,
      coalesce(new.payment_date, current_date),
      new.id
    )
    on conflict (commission_payment_id) do nothing;
  end if;

  return new;
end;
$$;
