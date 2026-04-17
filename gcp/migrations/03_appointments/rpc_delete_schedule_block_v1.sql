CREATE OR REPLACE FUNCTION public.delete_schedule_block_v1(p_block_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_block public.schedule_blocks%rowtype;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  SELECT * INTO v_block

  FROM public.schedule_blocks

  WHERE id = p_block_id AND tenant_id = v_profile.tenant_id;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Bloqueio n├úo encontrado' USING DETAIL = 'NOT_FOUND';

  END IF;



  IF NOT v_is_admin AND v_block.professional_id IS DISTINCT FROM v_profile.id THEN

    RAISE EXCEPTION 'Sem permiss├úo para remover este bloqueio' USING DETAIL = 'FORBIDDEN';

  END IF;



  DELETE FROM public.schedule_blocks WHERE id = p_block_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'schedule_block_deleted',

    'schedule_block',

    p_block_id::text,

    jsonb_build_object('professional_id', v_block.professional_id)

  );



  RETURN jsonb_build_object('success', true);

END;

$function$;