CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id    UUID;

  v_full_name    TEXT;

  v_clinic_name  TEXT;

  v_email        TEXT;

  v_phone        TEXT;

  v_invite_tid   TEXT;

  v_role         TEXT;

  v_prof_type    TEXT;

  v_council_type   TEXT;

  v_council_number TEXT;

  v_council_state  TEXT;

BEGIN

  -- PATH 1: Admin invite ÔÇö adiciona ao tenant existente como staff/admin

  IF (NEW.raw_user_meta_data->>'source') = 'admin_invite' THEN

    v_invite_tid := NULLIF(TRIM(NEW.raw_user_meta_data->>'tenant_id'), '');



    IF v_invite_tid IS NULL THEN

      RAISE EXCEPTION 'admin_invite: tenant_id obrigat├│rio em user_metadata'

        USING ERRCODE = 'invalid_parameter_value';

    END IF;



    BEGIN

      v_tenant_id := v_invite_tid::UUID;

    EXCEPTION WHEN invalid_text_representation THEN

      RAISE EXCEPTION 'admin_invite: tenant_id "%" n├úo ├® um UUID v├ílido', v_invite_tid

        USING ERRCODE = 'invalid_parameter_value';

    END;



    v_full_name := COALESCE(

      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),

      split_part(COALESCE(NEW.email, 'usuario'), '@', 1),

      'Usu├írio'

    );



    v_role := COALESCE(

      NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),

      'staff'

    );



    v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

    v_prof_type      := NULLIF(TRIM(NEW.raw_user_meta_data->>'professional_type'), '');

    v_council_type   := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_type'), '');

    v_council_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_number'), '');

    v_council_state  := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_state'), '');



    INSERT INTO public.profiles (

      user_id, tenant_id, full_name, email, phone,

      professional_type, council_type, council_number, council_state

    )

    VALUES (

      NEW.id, v_tenant_id, v_full_name, NEW.email, v_phone,

      COALESCE(v_prof_type, 'secretaria')::public.professional_type,

      v_council_type, v_council_number, v_council_state

    )

    ON CONFLICT (user_id) DO NOTHING;



    INSERT INTO public.user_roles (user_id, tenant_id, role)

    VALUES (NEW.id, v_tenant_id, v_role::public.app_role)

    ON CONFLICT (user_id, tenant_id) DO NOTHING;



    RAISE LOG 'handle_new_user[admin_invite]: user=% tenant=% role=%', NEW.id, v_tenant_id, v_role;

    RETURN NEW;

  END IF;



  -- ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

  -- PATH 2: Signup normal ÔÇö cria tenant + profile admin + subscription trial 7 dias

  -- ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ



  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN

    RAISE LOG 'handle_new_user: profile j├í existe para user_id=%, ignorando signup duplicado', NEW.id;

    RETURN NEW;

  END IF;



  v_full_name := COALESCE(

    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),

    split_part(COALESCE(NEW.email, 'usuario'), '@', 1),

    'Usu├írio'

  );



  v_clinic_name := COALESCE(

    NULLIF(TRIM(NEW.raw_user_meta_data->>'clinic_name'), ''),

    'Cl├¡nica ' || v_full_name,

    'Minha Cl├¡nica'

  );



  v_email  := NEW.email;

  v_phone  := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');



  v_prof_type      := NULLIF(TRIM(NEW.raw_user_meta_data->>'professional_type'), '');

  v_council_type   := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_type'), '');

  v_council_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_number'), '');

  v_council_state  := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_state'), '');



  INSERT INTO public.tenants (name, email)

  VALUES (v_clinic_name, v_email)

  RETURNING id INTO v_tenant_id;



  INSERT INTO public.profiles (

    user_id, tenant_id, full_name, email, phone,

    professional_type, council_type, council_number, council_state

  )

  VALUES (

    NEW.id, v_tenant_id, v_full_name, v_email, v_phone,

    COALESCE(v_prof_type, 'admin')::public.professional_type,

    v_council_type, v_council_number, v_council_state

  )

  ON CONFLICT (user_id) DO NOTHING;



  INSERT INTO public.user_roles (user_id, tenant_id, role)

  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role)

  ON CONFLICT (user_id, tenant_id) DO NOTHING;



  -- Trial de 7 dias com acesso total (equivalente ao Premium)

  INSERT INTO public.subscriptions (tenant_id, status, trial_start, trial_end)

  VALUES (v_tenant_id, 'trialing', now(), now() + INTERVAL '7 days')

  ON CONFLICT (tenant_id) DO NOTHING;



  RAISE LOG 'handle_new_user[signup]: user=% tenant=% clinic=% trial=7d', NEW.id, v_tenant_id, v_clinic_name;

  RETURN NEW;



EXCEPTION

  WHEN unique_violation THEN

    RAISE LOG 'handle_new_user: unique_violation para user_id=%, prov├ível duplicata ÔÇö ignorando', NEW.id;

    RETURN NEW;

  WHEN OTHERS THEN

    RAISE LOG 'handle_new_user: erro inesperado para user_id=% ÔÇö SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;

    RAISE;

END;

$function$;