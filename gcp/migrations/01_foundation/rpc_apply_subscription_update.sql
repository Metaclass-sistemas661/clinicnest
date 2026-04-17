CREATE OR REPLACE FUNCTION public.apply_subscription_update(p_tenant_id uuid, p_billing_provider text, p_event_key text, p_event_at timestamp with time zone, p_status text, p_plan text, p_current_period_end timestamp with time zone, p_customer_id text, p_provider_subscription_id text)
 RETURNS TABLE(applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_current public.subscriptions%rowtype;

  v_event_at timestamptz;

begin

  if p_tenant_id is null then

    raise exception 'tenant_id is required';

  end if;



  if p_event_key is null or btrim(p_event_key) = '' then

    raise exception 'event_key is required';

  end if;



  v_event_at := coalesce(p_event_at, now());



  select * into v_current

  from public.subscriptions s

  where s.tenant_id = p_tenant_id

  for update;



  if not found then

    return query select false, 'subscription_row_not_found';

    return;

  end if;



  if v_current.last_billing_event_key = p_event_key then

    return query select true, 'duplicate_event_key';

    return;

  end if;



  if v_current.last_billing_event_at is not null and v_event_at < v_current.last_billing_event_at then

    return query select false, 'out_of_order_event';

    return;

  end if;



  update public.subscriptions

    set billing_provider = coalesce(p_billing_provider, billing_provider),

        status = coalesce(p_status, status),

        plan = coalesce(p_plan, plan),

        current_period_end = coalesce(p_current_period_end, current_period_end),

        asaas_customer_id = coalesce(p_customer_id, asaas_customer_id),

        asaas_subscription_id = coalesce(p_provider_subscription_id, asaas_subscription_id),

        last_billing_provider = coalesce(p_billing_provider, last_billing_provider),

        last_billing_event_key = p_event_key,

        last_billing_event_at = v_event_at,

        updated_at = now()

  where tenant_id = p_tenant_id;



  return query select true, 'applied';

end;

$function$;