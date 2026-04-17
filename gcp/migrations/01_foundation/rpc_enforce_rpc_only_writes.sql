CREATE OR REPLACE FUNCTION public.enforce_rpc_only_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_role name := current_user;

BEGIN

  -- Allow internal/admin roles

  IF v_role IN ('postgres', 'service_role', 'supabase_admin') THEN

    IF TG_OP = 'DELETE' THEN

      RETURN OLD;

    END IF;

    RETURN NEW;

  END IF;



  -- Block end-user direct writes

  IF v_role IN ('anon', 'authenticated') THEN

    PERFORM public.raise_app_error(

      'DIRECT_WRITE_FORBIDDEN',

      format('Opera├º├úo %s direta bloqueada em %s. Use RPCs.', TG_OP, TG_TABLE_NAME)

    );

  END IF;



  -- Default deny for any unexpected role

  PERFORM public.raise_app_error(

    'DIRECT_WRITE_FORBIDDEN',

    format('Opera├º├úo %s bloqueada em %s (role=%s).', TG_OP, TG_TABLE_NAME, v_role)

  );

END;

$function$;