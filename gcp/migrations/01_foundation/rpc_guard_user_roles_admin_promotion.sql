CREATE OR REPLACE FUNCTION public.guard_user_roles_admin_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
      DECLARE
        v_caller_role TEXT;
        v_session_user TEXT;
        v_current_uid TEXT;
      BEGIN
        IF NEW.role != 'admin' THEN RETURN NEW; END IF;
        v_caller_role := current_setting('role', true);
        IF v_caller_role IN ('postgres','supabase_admin','service_role','supabase_auth_admin','authenticator') THEN RETURN NEW; END IF;
        v_session_user := session_user;
        IF v_session_user IN ('supabase_auth_admin','postgres','supabase_admin','clinicnest_admin') THEN RETURN NEW; END IF;
        v_current_uid := current_setting('app.current_user_id', true);
        IF v_current_uid IS NOT NULL AND v_current_uid != '' THEN
          IF public.is_tenant_admin(v_current_uid::uuid, NEW.tenant_id) THEN RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'Apenas administradores podem definir role=admin' USING ERRCODE = 'insufficient_privilege';
      END;
      $function$;