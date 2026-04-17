CREATE OR REPLACE FUNCTION public.upsert_user_tour_progress(p_tenant_id uuid, p_tour_key text, p_step_index integer, p_completed boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_id uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF p_tour_key IS NULL OR btrim(p_tour_key) = '' THEN

    RAISE EXCEPTION 'tour_key ├® obrigat├│rio';

  END IF;



  IF p_tenant_id IS NULL THEN

    RAISE EXCEPTION 'tenant_id ├® obrigat├│rio';

  END IF;



  -- Ensure user belongs to tenant

  IF NOT EXISTS (

    SELECT 1

    FROM public.profiles p

    WHERE p.user_id = v_user_id

      AND p.tenant_id = p_tenant_id

  ) THEN

    RAISE EXCEPTION 'Usu├írio n├úo pertence ao tenant';

  END IF;



  INSERT INTO public.user_tour_progress (tenant_id, user_id, tour_key, step_index, completed_at)

  VALUES (

    p_tenant_id,

    v_user_id,

    p_tour_key,

    GREATEST(0, COALESCE(p_step_index, 0)),

    CASE WHEN p_completed THEN now() ELSE NULL END

  )

  ON CONFLICT (user_id, tour_key)

  DO UPDATE SET

    tenant_id = EXCLUDED.tenant_id,

    step_index = EXCLUDED.step_index,

    completed_at = CASE

      WHEN p_completed THEN now()

      ELSE NULL

    END

  RETURNING id INTO v_id;



  RETURN v_id;

END;

$function$;