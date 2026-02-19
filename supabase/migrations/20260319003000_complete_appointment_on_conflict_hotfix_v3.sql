-- Hotfix v3: 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification".
-- Garante índices únicos compatíveis com os ON CONFLICT usados pelo RPC complete_appointment_with_sale
-- nas tabelas commission_payments e appointment_completion_summaries.

-- Comissão: no máximo 1 pagamento de comissão por agendamento
create unique index if not exists commission_payments_appointment_id_unique_v2
  on public.commission_payments(appointment_id)
  where appointment_id is not null;

-- Summary: no máximo 1 completion summary por agendamento
create unique index if not exists appointment_completion_summaries_appointment_id_unique_v2
  on public.appointment_completion_summaries(appointment_id)
  where appointment_id is not null;
