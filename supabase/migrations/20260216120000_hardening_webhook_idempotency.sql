create or replace function public.claim_asaas_webhook_event(
  p_event_key text,
  p_event_type text,
  p_payload jsonb
)
returns table(
  status text,
  attempts integer,
  already_processed boolean,
  claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  insert into public.asaas_webhook_events (event_key, event_type, status, attempts, payload)
  values (p_event_key, p_event_type, 'received', 1, p_payload)
  on conflict (event_key) do update
    set attempts = public.asaas_webhook_events.attempts + 1,
        event_type = coalesce(public.asaas_webhook_events.event_type, excluded.event_type),
        payload = coalesce(public.asaas_webhook_events.payload, excluded.payload);

  if exists (
    select 1
    from public.asaas_webhook_events e
    where e.event_key = p_event_key
      and e.status = 'processed'
  ) then
    return query
    select
      e.status,
      e.attempts,
      true as already_processed,
      false as claimed
    from public.asaas_webhook_events e
    where e.event_key = p_event_key;
    return;
  end if;

  v_locked := pg_try_advisory_xact_lock(hashtext(p_event_key), hashtext('asaas_webhook'));

  if not v_locked then
    return query
    select
      e.status,
      e.attempts,
      (e.status = 'processed') as already_processed,
      false as claimed
    from public.asaas_webhook_events e
    where e.event_key = p_event_key;
    return;
  end if;

  update public.asaas_webhook_events
    set status = 'processing'
  where event_key = p_event_key
    and status <> 'processed';

  return query
  select
    e.status,
    e.attempts,
    (e.status = 'processed') as already_processed,
    (e.status = 'processing') as claimed
  from public.asaas_webhook_events e
  where e.event_key = p_event_key;
end;
$$;

grant execute on function public.claim_asaas_webhook_event(text, text, jsonb) to service_role;
