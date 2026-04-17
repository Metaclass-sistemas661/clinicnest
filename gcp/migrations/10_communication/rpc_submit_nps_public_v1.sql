CREATE OR REPLACE FUNCTION public.submit_nps_public_v1(p_token uuid, p_score integer, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_row public.nps_responses%rowtype;

begin

  if p_score is null or p_score < 0 or p_score > 10 then

    perform public.raise_app_error('VALIDATION_ERROR', 'Score inv├ílido');

  end if;



  select * into v_row

  from public.nps_responses r

  where r.token = p_token

  limit 1;



  if not found then

    perform public.raise_app_error('NOT_FOUND', 'Token inv├ílido');

  end if;



  if v_row.responded_at is not null then

    return jsonb_build_object('success', true, 'already_responded', true);

  end if;



  update public.nps_responses

    set score = p_score,

        comment = nullif(btrim(coalesce(p_comment,'')),''),

        responded_at = now()

  where token = p_token

    and responded_at is null;



  return jsonb_build_object('success', true, 'already_responded', false);

end;

$function$;