CREATE OR REPLACE FUNCTION public.create_client_package_v1(p_client_id uuid, p_service_id uuid, p_total_sessions integer, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_pkg_id uuid;

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

    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem criar pacotes');

  end if;



  if p_total_sessions is null or p_total_sessions <= 0 then

    perform public.raise_app_error('VALIDATION_ERROR', 'Quantidade de sess├Áes inv├ílida');

  end if;



  if not exists (select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id) then

    perform public.raise_app_error('NOT_FOUND', 'Cliente n├úo encontrado');

  end if;



  if not exists (select 1 from public.services s where s.id = p_service_id and s.tenant_id = v_profile.tenant_id and s.is_active = true) then

    perform public.raise_app_error('NOT_FOUND', 'Servi├ºo n├úo encontrado');

  end if;



  insert into public.client_packages(

    tenant_id, client_id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, notes, created_by

  ) values (

    v_profile.tenant_id, p_client_id, p_service_id, p_total_sessions, p_total_sessions, 'active', now(), p_expires_at, nullif(btrim(p_notes), ''), v_user_id

  ) returning id into v_pkg_id;



  insert into public.client_package_ledger(

    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id

  ) values (

    v_profile.tenant_id, v_pkg_id, null, p_total_sessions, 'purchase', 'Compra de pacote', v_user_id

  );



  return jsonb_build_object('success', true, 'package_id', v_pkg_id);

end;

$function$;