CREATE OR REPLACE FUNCTION public.get_nps_public_v1(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_row public.nps_responses%rowtype;

  v_tenant_name text;

begin

  select * into v_row

  from public.nps_responses r

  where r.token = p_token

  limit 1;



  if not found then

    return jsonb_build_object('found', false);

  end if;



  select t.name into v_tenant_name

  from public.tenants t

  where t.id = v_row.tenant_id

  limit 1;



  return jsonb_build_object(

    'found', true,

    'tenant_id', v_row.tenant_id,

    'tenant_name', coalesce(v_tenant_name, 'BeautyGest'),

    'appointment_id', v_row.appointment_id,

    'client_id', v_row.client_id,

    'score', v_row.score,

    'comment', v_row.comment,

    'responded_at', v_row.responded_at,

    'created_at', v_row.created_at

  );

end;

$function$;