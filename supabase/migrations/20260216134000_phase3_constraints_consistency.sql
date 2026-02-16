-- Phase 3: Consistency invariants (prevent duplicate side-effects)

-- 1) Ensure at most one commission_payment per appointment
create unique index if not exists commission_payments_appointment_id_unique
  on public.commission_payments(appointment_id)
  where appointment_id is not null;

-- 2) Ensure at most one completion summary per appointment
create unique index if not exists appointment_completion_summaries_appointment_id_unique
  on public.appointment_completion_summaries(appointment_id)
  where appointment_id is not null;

-- 3) Basic invariants for stock_movements
-- quantity sign should match movement_type
alter table public.stock_movements
  drop constraint if exists stock_movements_quantity_sign_check;

alter table public.stock_movements
  add constraint stock_movements_quantity_sign_check
  check (
    (movement_type = 'in' and quantity > 0)
    or (movement_type = 'out' and quantity < 0)
  );

-- 4) Basic invariants for financial_transactions
-- amount must be non-negative (type controls semantics)
alter table public.financial_transactions
  drop constraint if exists financial_transactions_amount_nonnegative_check;

alter table public.financial_transactions
  add constraint financial_transactions_amount_nonnegative_check
  check (amount >= 0);
