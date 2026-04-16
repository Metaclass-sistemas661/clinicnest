-- Migration: Fix schema gaps that break tenant-creation triggers
-- Date: 2026-04-16  
-- Issues fixed:
--   1. payment_methods missing 'code' and 'sort_order' columns (required by seed_payment_methods_for_tenant trigger)
--   2. payment_methods missing UNIQUE(tenant_id, code) constraint (required by ON CONFLICT in trigger)
--   3. payment_methods.type missing DEFAULT (NOT NULL column not set by trigger)
--   4. lgpd_retention_policies.data_category missing DEFAULT (NOT NULL column not set by trigger)
--   5. lgpd_retention_policies missing UNIQUE(tenant_id) constraint (required by ON CONFLICT in trigger)
--   6. guard_user_roles_admin_promotion trigger using current_setting() without missing_ok, 
--      and not recognising clinicnest_admin as privileged session_user

-- 1. payment_methods: add missing columns
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE payment_methods ALTER COLUMN type SET DEFAULT 'other';

-- 2. payment_methods: add UNIQUE constraint (idempotent)
DO $$ BEGIN
  ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_tenant_id_code_key UNIQUE(tenant_id, code);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 3. lgpd_retention_policies: add DEFAULT for data_category
ALTER TABLE lgpd_retention_policies ALTER COLUMN data_category SET DEFAULT 'geral';

-- 4. lgpd_retention_policies: add UNIQUE constraint (idempotent)
DO $$ BEGIN
  ALTER TABLE lgpd_retention_policies ADD CONSTRAINT lgpd_retention_policies_tenant_id_key UNIQUE(tenant_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 5. Fix guard_user_roles_admin_promotion trigger function
CREATE OR REPLACE FUNCTION public.guard_user_roles_admin_promotion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  v_caller_role TEXT;
  v_session_user TEXT;
  v_current_uid TEXT;
BEGIN
  IF NEW.role != 'admin' THEN RETURN NEW; END IF;

  v_caller_role := current_setting('role', true);
  IF v_caller_role IN ('postgres','supabase_admin','service_role','supabase_auth_admin','authenticator') THEN
    RETURN NEW;
  END IF;

  v_session_user := session_user;
  IF v_session_user IN ('supabase_auth_admin','postgres','supabase_admin','clinicnest_admin') THEN
    RETURN NEW;
  END IF;

  v_current_uid := current_setting('app.current_user_id', true);
  IF v_current_uid IS NOT NULL AND v_current_uid != '' THEN
    IF public.is_tenant_admin(v_current_uid::uuid, NEW.tenant_id) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Apenas administradores podem definir role=admin'
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;
