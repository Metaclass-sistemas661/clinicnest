CREATE OR REPLACE FUNCTION public.archive_goal_v2(p_goal_id uuid, p_archived boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_archived_at timestamptz;

  v_priority integer;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');

  END IF;



  IF p_archived THEN

    v_archived_at := now();

    v_priority := 0;

  ELSE

    v_archived_at := NULL;

    v_priority := NULL;

  END IF;



  UPDATE public.goals

  SET archived_at = v_archived_at,

      updated_at = now(),

      show_in_header = CASE WHEN p_archived THEN false ELSE show_in_header END,

      header_priority = CASE WHEN p_archived THEN 0 ELSE header_priority END

  WHERE id = p_goal_id

    AND tenant_id = v_profile.tenant_id;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('NOT_FOUND', 'Meta n├úo encontrada');

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    CASE WHEN p_archived THEN 'goal_archived' ELSE 'goal_unarchived' END,

    'goal',

    p_goal_id::text,

    jsonb_build_object('archived', p_archived)

  );



  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id, 'archived', p_archived);

END;

$function$;