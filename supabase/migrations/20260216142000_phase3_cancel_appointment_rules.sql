-- Phase 3: Appointment cancel rules (cannot cancel completed) + RPC

create or replace function public.prevent_cancel_completed_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' and new.status = 'cancelled' then
    raise exception 'Não é permitido cancelar um agendamento concluído';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_cancel_completed_appointments on public.appointments;
create trigger trg_prevent_cancel_completed_appointments
before update of status on public.appointments
for each row
execute function public.prevent_cancel_completed_appointments();

create or replace function public.cancel_appointment(
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
  v_apt public.appointments%rowtype;
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('cancel_appointment'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    raise exception 'Agendamento não encontrado';
  end if;

  if v_apt.status = 'completed' then
    raise exception 'Não é permitido cancelar um agendamento concluído';
  end if;

  if not v_is_admin and v_apt.professional_id is distinct from v_profile.id then
    raise exception 'Sem permissão para cancelar este agendamento';
  end if;

  if v_apt.status = 'cancelled' then
    return jsonb_build_object('success', true, 'already_cancelled', true, 'appointment_id', v_apt.id);
  end if;

  update public.appointments
    set status = 'cancelled',
        updated_at = now(),
        notes = case when p_reason is null or btrim(p_reason) = '' then notes else coalesce(notes, '') || '\nCancelamento: ' || p_reason end
  where id = v_apt.id
    and tenant_id = v_profile.tenant_id;

  return jsonb_build_object('success', true, 'already_cancelled', false, 'appointment_id', v_apt.id);
end;
$$;

revoke all on function public.cancel_appointment(uuid, text) from public;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to service_role;
