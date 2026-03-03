-- ============================================================================
-- Migration: RLS Hardening — user_roles self-promotion prevention
-- Description: 
--   GAP 3: A policy "Users can create their own role during signup" allows
--   any authenticated user to INSERT into user_roles with user_id = auth.uid().
--   This means a staff member could theoretically set role = 'admin'.
--
--   Fix: Add a BEFORE INSERT OR UPDATE trigger that validates:
--   1. During signup (trigger context / no existing roles): allow any role
--      (handle_new_user runs as SECURITY DEFINER so this trigger won't block it)
--   2. For direct INSERT/UPDATE by authenticated users:
--      - Setting role='admin' requires the caller to already be admin in that tenant
--      - Staff cannot self-promote to admin
--
--   Also tighten the "Users can create their own role during signup" policy
--   to only allow role='staff' (the handle_new_user trigger uses SECURITY DEFINER
--   and bypasses RLS entirely, so admin role assignment during signup still works).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tighten RLS policy: self-insert only allows staff role
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create their own role during signup" ON public.user_roles;

CREATE POLICY "Users can create their own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'staff'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger guard: prevent non-admin from setting role='admin'
--    This is a defense-in-depth measure on top of RLS.
--    handle_new_user() is SECURITY DEFINER and bypasses RLS, but this trigger
--    still fires. We detect the SECURITY DEFINER context by checking
--    current_setting('role') = 'postgres' or 'supabase_admin'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_user_roles_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- If the new role is not admin, allow unconditionally
  IF NEW.role != 'admin' THEN
    RETURN NEW;
  END IF;

  -- Allow if running in privileged context (triggers, migrations, service_role)
  v_caller_role := current_setting('role', true);
  IF v_caller_role IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Allow if running inside handle_new_user trigger (session_replication_role = 'replica' is not set, 
  -- but we can check if the caller is already admin in that tenant)
  -- For authenticated users: only allow if they are already admin in the target tenant
  IF public.is_tenant_admin(auth.uid(), NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  -- Block: non-admin trying to set role='admin'
  RAISE EXCEPTION 'Apenas administradores podem definir role=admin'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_roles_admin_promotion ON public.user_roles;

CREATE TRIGGER trg_guard_user_roles_admin_promotion
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_roles_admin_promotion();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Prevent staff from deleting their own role (to re-insert as admin)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users cannot delete their own roles" ON public.user_roles;

CREATE POLICY "Users cannot delete their own roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete roles, and they cannot delete their own
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND user_id != auth.uid()
);
