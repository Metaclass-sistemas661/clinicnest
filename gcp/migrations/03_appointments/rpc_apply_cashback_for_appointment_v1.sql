CREATE OR REPLACE FUNCTION public.apply_cashback_for_appointment_v1(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_apt public.appointments%rowtype;

  v_tenant public.tenants%rowtype;

  v_amount numeric;

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



  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('apply_cashback_for_appointment_v1'));



  select * into v_apt

  from public.appointments a

  where a.id = p_appointment_id

    and a.tenant_id = v_profile.tenant_id

  for update;



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Agendamento n├úo encontrado');

  end if;



  if v_apt.status <> 'completed' then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'not_completed');

  end if;



  if v_apt.client_id is null then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'missing_client');

  end if;



  if exists (

    select 1 from public.appointment_cashback_earnings e

    where e.tenant_id = v_apt.tenant_id

      and e.appointment_id = v_apt.id

  ) then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'already_applied');

  end if;



  select * into v_tenant

  from public.tenants t

  where t.id = v_apt.tenant_id

  limit 1;



  if v_tenant.cashback_enabled is distinct from true then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'disabled');

  end if;



  if coalesce(v_tenant.cashback_percent, 0) <= 0 then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'percent_zero');

  end if;



  v_amount := round(coalesce(v_apt.price, 0) * (v_tenant.cashback_percent / 100), 2);

  if v_amount <= 0 then

    return jsonb_build_object('success', true, 'applied', false, 'reason', 'amount_zero');

  end if;



  insert into public.cashback_wallets(tenant_id, client_id, balance)

  values (v_apt.tenant_id, v_apt.client_id, 0)

  on conflict (tenant_id, client_id) do nothing;



  insert into public.appointment_cashback_earnings(tenant_id, appointment_id, client_id, earned_amount)

  values (v_apt.tenant_id, v_apt.id, v_apt.client_id, v_amount);



  insert into public.cashback_ledger(

    tenant_id, client_id, appointment_id, delta_amount, reason, notes, actor_user_id

  ) values (

    v_apt.tenant_id,

    v_apt.client_id,

    v_apt.id,

    v_amount,

    'earn',

    'Cashback por atendimento conclu├¡do',

    v_user_id

  );



  update public.cashback_wallets

    set balance = balance + v_amount,

        updated_at = now()

  where tenant_id = v_apt.tenant_id

    and client_id = v_apt.client_id;



  return jsonb_build_object('success', true, 'applied', true, 'amount', v_amount);

end;

$function$;