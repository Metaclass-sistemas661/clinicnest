-- Milestone 5: estorno (reversão) do consumo de pacote por appointment (admin)

create or replace function public.revert_package_consumption_for_appointment_v1(
  p_appointment_id uuid,
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
  v_is_admin boolean := false;

  v_consumption public.appointment_package_consumptions%rowtype;
  v_pkg public.client_packages%rowtype;
  v_apt public.appointments%rowtype;
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
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem estornar pacote');
  end if;

  if p_appointment_id is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'appointment_id é obrigatório');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('revert_package_consumption_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  select * into v_consumption
  from public.appointment_package_consumptions c
  where c.appointment_id = p_appointment_id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', true, 'reverted', false, 'reason', 'not_consumed');
  end if;

  select * into v_pkg
  from public.client_packages p
  where p.id = v_consumption.package_id
    and p.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Pacote não encontrado');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pkg.id::text), hashtext('revert_client_package'));

  delete from public.appointment_package_consumptions
  where appointment_id = p_appointment_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id,
    v_pkg.id,
    p_appointment_id,
    1,
    'revert',
    coalesce(nullif(btrim(p_reason), ''), 'Estorno manual de consumo do pacote'),
    v_user_id
  );

  update public.client_packages
    set remaining_sessions = remaining_sessions + 1,
        status = 'active',
        updated_at = now()
  where id = v_pkg.id
    and tenant_id = v_profile.tenant_id;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'client_package_consumption_reverted',
    'appointment',
    p_appointment_id::text,
    jsonb_build_object(
      'package_id', v_pkg.id,
      'delta_sessions', 1,
      'reason', nullif(btrim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'reverted', true,
    'package_id', v_pkg.id,
    'appointment_id', p_appointment_id
  );
end;
$$;

revoke all on function public.revert_package_consumption_for_appointment_v1(uuid, text) from public;
grant execute on function public.revert_package_consumption_for_appointment_v1(uuid, text) to authenticated;
grant execute on function public.revert_package_consumption_for_appointment_v1(uuid, text) to service_role;
