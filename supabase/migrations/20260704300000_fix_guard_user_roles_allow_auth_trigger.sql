-- ============================================================================
-- Migration: Fix guard_user_roles_admin_promotion — allow handle_new_user trigger
-- ============================================================================
-- Problem: The guard trigger blocks INSERT with role='admin' during signup
-- because handle_new_user() runs via GoTrue as session_user='supabase_auth_admin'
-- with current_setting('role')='supabase_auth_admin', which was not in the
-- allowlist. This caused "Database error saving new user" on every signup.
--
-- Fix: Also allow 'supabase_auth_admin' and 'authenticator' as privileged
-- callers, since these are the roles used by Supabase Auth (GoTrue) when
-- executing auth triggers like handle_new_user().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_user_roles_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_session_user TEXT;
BEGIN
  -- If the new role is not admin, allow unconditionally
  IF NEW.role != 'admin' THEN
    RETURN NEW;
  END IF;

  -- Allow if running in privileged context (triggers, migrations, service_role, auth)
  v_caller_role := current_setting('role', true);
  IF v_caller_role IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin', 'authenticator') THEN
    RETURN NEW;
  END IF;

  -- Also check session_user for GoTrue auth trigger context
  v_session_user := session_user;
  IF v_session_user IN ('supabase_auth_admin', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- For authenticated users: only allow if they are already admin in the target tenant
  IF public.is_tenant_admin(auth.uid(), NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  -- Block: non-admin trying to set role='admin'
  RAISE EXCEPTION 'Apenas administradores podem definir role=admin'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
