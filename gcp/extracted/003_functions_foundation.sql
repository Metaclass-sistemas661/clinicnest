-- GCP Migration: Functions - foundation
-- Total: 24 functions


-- ============================================
-- Function: get_user_tenant_id
-- Source: 20260703000000_fix_patient_portal_renames_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1),
    (SELECT tenant_id FROM public.patient_profiles WHERE user_id = p_user_id AND is_active = true LIMIT 1)
  );
$$;


-- ============================================
-- Function: has_role
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = p_role
    );
$$;


-- ============================================
-- Function: is_tenant_admin
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND role = 'admin'
    );
$$;


-- ============================================
-- Function: handle_new_user
-- Source: 20260715000000_trial_7_days_kill_freemium.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- PATH 1: Admin invite — adiciona ao tenant existente como staff/admin
  IF (NEW.raw_user_meta_data->>'source') = 'admin_invite' THEN
    v_invite_tid := NULLIF(TRIM(NEW.raw_user_meta_data->>'tenant_id'), '');

    IF v_invite_tid IS NULL THEN
      RAISE EXCEPTION 'admin_invite: tenant_id obrigatório em user_metadata'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    BEGIN
      v_tenant_id := v_invite_tid::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'admin_invite: tenant_id "%" não é um UUID válido', v_invite_tid
        USING ERRCODE = 'invalid_parameter_value';
    END;

    v_full_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
      'Usuário'
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

  -- ──────────────────────────────────────────────────────────────────────────
  -- PATH 2: Signup normal — cria tenant + profile admin + subscription trial 7 dias
  -- ──────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    RAISE LOG 'handle_new_user: profile já existe para user_id=%, ignorando signup duplicado', NEW.id;
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
    'Usuário'
  );

  v_clinic_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'clinic_name'), ''),
    'Clínica ' || v_full_name,
    'Minha Clínica'
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
    RAISE LOG 'handle_new_user: unique_violation para user_id=%, provável duplicata — ignorando', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: erro inesperado para user_id=% — SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
    RAISE;
END;
$$;


-- ============================================
-- Function: log_tenant_action
-- Source: 20260215172000_audit_logs_core.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.log_tenant_action(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_actor_role text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Ação de auditoria é obrigatória';
  END IF;

  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'Tipo de entidade é obrigatório';
  END IF;

  -- If called from a client session, ensure the actor belongs to tenant.
  IF auth.uid() IS NOT NULL THEN
    IF p_actor_user_id IS NULL THEN
      p_actor_user_id := auth.uid();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = p_actor_user_id
        AND p.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Usuário não pertence ao tenant';
    END IF;
  END IF;

  SELECT ur.role::text INTO v_actor_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_actor_user_id
    AND ur.tenant_id = p_tenant_id
  LIMIT 1;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_actor_user_id,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ============================================
-- Function: apply_subscription_update
-- Source: 20260216123000_apply_subscription_update.sql
-- ============================================
create or replace function public.apply_subscription_update(
  p_tenant_id uuid,
  p_billing_provider text,
  p_event_key text,
  p_event_at timestamptz,
  p_status text,
  p_plan text,
  p_current_period_end timestamptz,
  p_customer_id text,
  p_provider_subscription_id text
)
returns table(
  applied boolean,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.subscriptions%rowtype;
  v_event_at timestamptz;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id is required';
  end if;

  if p_event_key is null or btrim(p_event_key) = '' then
    raise exception 'event_key is required';
  end if;

  v_event_at := coalesce(p_event_at, now());

  select * into v_current
  from public.subscriptions s
  where s.tenant_id = p_tenant_id
  for update;

  if not found then
    return query select false, 'subscription_row_not_found';
    return;
  end if;

  if v_current.last_billing_event_key = p_event_key then
    return query select true, 'duplicate_event_key';
    return;
  end if;

  if v_current.last_billing_event_at is not null and v_event_at < v_current.last_billing_event_at then
    return query select false, 'out_of_order_event';
    return;
  end if;

  update public.subscriptions
    set billing_provider = coalesce(p_billing_provider, billing_provider),
        status = coalesce(p_status, status),
        plan = coalesce(p_plan, plan),
        current_period_end = coalesce(p_current_period_end, current_period_end),
        asaas_customer_id = coalesce(p_customer_id, asaas_customer_id),
        asaas_subscription_id = coalesce(p_provider_subscription_id, asaas_subscription_id),
        last_billing_provider = coalesce(p_billing_provider, last_billing_provider),
        last_billing_event_key = p_event_key,
        last_billing_event_at = v_event_at,
        updated_at = now()
  where tenant_id = p_tenant_id;

  return query select true, 'applied';
end;
$$;


-- ============================================
-- Function: log_admin_action
-- Source: 20260304000000_lgpd_governance_phase2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_log_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Ação de auditoria é obrigatória';
  END IF;

  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'Tipo de entidade é obrigatório';
  END IF;

  IF NOT public.is_tenant_admin(v_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar trilha de auditoria';
  END IF;

  INSERT INTO public.admin_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_tenant_id,
    v_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ============================================
-- Function: get_my_context
-- Source: 20260323400000_rbac_foundation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.user_roles%rowtype;
  v_tenant public.tenants%rowtype;
  v_permissions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('profile', NULL, 'role', NULL, 'tenant', NULL, 'permissions', '{}'::jsonb);
  END IF;

  SELECT * INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.tenant_id = v_profile.tenant_id
  LIMIT 1;

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_profile.tenant_id
  LIMIT 1;

  v_permissions := public.get_effective_permissions(v_user_id);

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'role', CASE WHEN v_role.id IS NULL THEN NULL ELSE to_jsonb(v_role) END,
    'tenant', CASE WHEN v_tenant.id IS NULL THEN NULL ELSE to_jsonb(v_tenant) END,
    'permissions', v_permissions
  );
END;
$$;


-- ============================================
-- Function: raise_app_error
-- Source: 20260310130000_app_error_codes.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.raise_app_error(
  p_code text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', COALESCE(p_message, 'Erro')
    USING ERRCODE = 'P0001',
          DETAIL = COALESCE(NULLIF(btrim(p_code), ''), 'unknown');
END;
$$;


-- ============================================
-- Function: enforce_rpc_only_writes
-- Source: 20260310141000_write_guard_rpc_only.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_rpc_only_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      format('Operação %s direta bloqueada em %s. Use RPCs.', TG_OP, TG_TABLE_NAME)
    );
  END IF;

  -- Default deny for any unexpected role
  PERFORM public.raise_app_error(
    'DIRECT_WRITE_FORBIDDEN',
    format('Operação %s bloqueada em %s (role=%s).', TG_OP, TG_TABLE_NAME, v_role)
  );
END;
$$;


-- ============================================
-- Function: get_security_diagnostics_v1
-- Source: 20260310147000_security_diagnostics_rpc.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_security_diagnostics_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_tables text[] := ARRAY[
    'appointments',
    'clients',
    'services',
    'products',
    'product_categories',
    'stock_movements',
    'financial_transactions',
    'commission_payments',
    'goals',
    'goal_templates',
    'audit_logs',
    'appointment_completion_summaries'
  ];
  v_table text;
  v_rls jsonb := '[]'::jsonb;
  v_triggers jsonb := '[]'::jsonb;
  v_functions jsonb := '[]'::jsonb;
  v_indexes jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode acessar diagnóstico');
  END IF;

  -- RLS checks
  FOREACH v_table IN ARRAY v_tables LOOP
    v_rls := v_rls || jsonb_build_array(
      jsonb_build_object(
        'table', v_table,
        'rls_enabled', coalesce((
          select c.relrowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relname = v_table
        ), false),
        'rls_forced', coalesce((
          select c.relforcerowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relname = v_table
        ), false)
      )
    );
  END LOOP;

  -- Trigger checks (write-guard)
  v_triggers := jsonb_build_array(
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_appointments',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_appointments')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_financial_transactions',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_financial_transactions')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_stock_movements',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_stock_movements')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_commission_payments',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_commission_payments')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_appointment_completion_summaries',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_appointment_completion_summaries')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_services',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_services')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_clients',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_clients')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_goals',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_goals')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_goal_templates',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_goal_templates')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_product_categories',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_product_categories')
    ),
    jsonb_build_object(
      'name', 'trg_enforce_rpc_only_writes_products',
      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_products')
    )
  );

  -- Function checks
  v_functions := jsonb_build_array(
    jsonb_build_object('name','raise_app_error','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='raise_app_error')),
    jsonb_build_object('name','enforce_rpc_only_writes','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='enforce_rpc_only_writes')),
    jsonb_build_object('name','get_my_context','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='get_my_context')),
    jsonb_build_object('name','create_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_appointment_v2')),
    jsonb_build_object('name','update_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='update_appointment_v2')),
    jsonb_build_object('name','set_appointment_status_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='set_appointment_status_v2')),
    jsonb_build_object('name','delete_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='delete_appointment_v2')),
    jsonb_build_object('name','create_financial_transaction_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_financial_transaction_v2')),
    jsonb_build_object('name','create_product_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_product_v2')),
    jsonb_build_object('name','adjust_stock','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='adjust_stock')),
    jsonb_build_object('name','cancel_appointment','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='cancel_appointment')),
    jsonb_build_object('name','mark_commission_paid','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='mark_commission_paid'))
  );

  -- Index checks (best effort)
  v_indexes := jsonb_build_array(
    jsonb_build_object('name','idx_appointments_tenant_professional_scheduled_at_not_cancelled','exists', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_appointments_tenant_professional_scheduled_at_not_cancelled')),
    jsonb_build_object('name','idx_audit_logs_tenant_created_at','exists', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_audit_logs_tenant_created_at'))
  );

  RETURN jsonb_build_object(
    'tenant_id', v_profile.tenant_id,
    'generated_at', now(),
    'rls', v_rls,
    'triggers', v_triggers,
    'functions', v_functions,
    'indexes', v_indexes
  );
END;
$$;


-- ============================================
-- Function: on_tenant_created_seed_templates
-- Source: 20260323400000_rbac_foundation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.on_tenant_created_seed_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_role_templates_for_tenant(NEW.id);
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_effective_permissions
-- Source: 20260323800000_rbac_refinements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_prof_type public.professional_type;
  v_is_admin BOOLEAN;
  v_is_readonly BOOLEAN;
  v_base JSONB;
  v_resource TEXT;
  v_override JSONB;
  v_perm JSONB;
BEGIN
  SELECT p.tenant_id, p.professional_type, p.is_readonly
  INTO v_tenant_id, v_prof_type, v_is_readonly
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.tenant_id = v_tenant_id AND ur.role = 'admin'
  );

  IF v_is_admin THEN
    SELECT permissions INTO v_base
    FROM public.role_templates
    WHERE tenant_id = v_tenant_id AND professional_type = 'admin'
    LIMIT 1;
  ELSE
    SELECT permissions INTO v_base
    FROM public.role_templates
    WHERE tenant_id = v_tenant_id AND professional_type = v_prof_type
    LIMIT 1;
  END IF;

  v_base := COALESCE(v_base, '{}'::jsonb);

  -- Apply overrides (global, unit_id IS NULL)
  FOR v_resource, v_override IN
    SELECT po.resource, jsonb_build_object(
      'view', po.can_view,
      'create', po.can_create,
      'edit', po.can_edit,
      'delete', po.can_delete
    )
    FROM public.permission_overrides po
    WHERE po.tenant_id = v_tenant_id AND po.user_id = p_user_id AND po.unit_id IS NULL
  LOOP
    v_base := v_base || jsonb_build_object(v_resource, v_override);
  END LOOP;

  -- If readonly mode, strip create/edit/delete from all resources
  IF v_is_readonly AND NOT v_is_admin THEN
    FOR v_resource IN SELECT jsonb_object_keys(v_base) LOOP
      v_perm := v_base->v_resource;
      v_base := v_base || jsonb_build_object(
        v_resource, jsonb_build_object(
          'view', COALESCE((v_perm->>'view')::boolean, false),
          'create', false,
          'edit', false,
          'delete', false
        )
      );
    END LOOP;
  END IF;

  RETURN v_base;
END;
$$;


-- ============================================
-- Function: clone_permission_overrides
-- Source: 20260323800000_rbac_refinements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.clone_permission_overrides(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem clonar permissões';
  END IF;

  -- Verify both users belong to same tenant
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_source_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário de origem não pertence ao tenant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário de destino não pertence ao tenant';
  END IF;

  -- Delete existing overrides for target
  DELETE FROM public.permission_overrides
  WHERE tenant_id = v_tenant_id AND user_id = p_target_user_id;

  -- Copy from source to target
  INSERT INTO public.permission_overrides (tenant_id, user_id, resource, can_view, can_create, can_edit, can_delete, unit_id)
  SELECT v_tenant_id, p_target_user_id, resource, can_view, can_create, can_edit, can_delete, unit_id
  FROM public.permission_overrides
  WHERE tenant_id = v_tenant_id AND user_id = p_source_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================
-- Function: get_tenant_overrides
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_overrides()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSON;
BEGIN
  -- Obter tenant_id do usuário autenticado
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('features', '[]'::json, 'limits', '[]'::json);
  END IF;

  SELECT json_build_object(
    'features', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'feature_key', feature_key,
        'is_enabled', is_enabled,
        'reason', reason,
        'expires_at', expires_at
      ))
      FROM tenant_feature_overrides
      WHERE tenant_id = v_tenant_id
        AND (expires_at IS NULL OR expires_at > now())
    ), '[]'::json),
    'limits', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'limit_key', limit_key,
        'custom_value', custom_value,
        'reason', reason,
        'expires_at', expires_at
      ))
      FROM tenant_limit_overrides
      WHERE tenant_id = v_tenant_id
        AND (expires_at IS NULL OR expires_at > now())
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: create_feature_override
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION create_feature_override(
  p_tenant_id UUID,
  p_feature_key TEXT,
  p_is_enabled BOOLEAN DEFAULT true,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
BEGIN
  -- Verificar se o usuário é super-admin (implementar lógica específica)
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Inserir ou atualizar override
  INSERT INTO tenant_feature_overrides (
    tenant_id, feature_key, is_enabled, reason, enabled_by, expires_at
  ) VALUES (
    p_tenant_id, p_feature_key, p_is_enabled, p_reason, v_actor_id, p_expires_at
  )
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    reason = EXCLUDED.reason,
    enabled_by = EXCLUDED.enabled_by,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, new_value, changed_by
  ) VALUES (
    p_tenant_id, 'feature', v_override_id, 'created',
    json_build_object(
      'feature_key', p_feature_key,
      'is_enabled', p_is_enabled,
      'reason', p_reason,
      'expires_at', p_expires_at
    ),
    v_actor_id
  );

  RETURN v_override_id;
END;
$$;


-- ============================================
-- Function: create_limit_override
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION create_limit_override(
  p_tenant_id UUID,
  p_limit_key TEXT,
  p_custom_value INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
BEGIN
  -- Verificar se o usuário é super-admin (implementar lógica específica)
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Inserir ou atualizar override
  INSERT INTO tenant_limit_overrides (
    tenant_id, limit_key, custom_value, reason, enabled_by, expires_at
  ) VALUES (
    p_tenant_id, p_limit_key, p_custom_value, p_reason, v_actor_id, p_expires_at
  )
  ON CONFLICT (tenant_id, limit_key) DO UPDATE SET
    custom_value = EXCLUDED.custom_value,
    reason = EXCLUDED.reason,
    enabled_by = EXCLUDED.enabled_by,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, new_value, changed_by
  ) VALUES (
    p_tenant_id, 'limit', v_override_id, 'created',
    json_build_object(
      'limit_key', p_limit_key,
      'custom_value', p_custom_value,
      'reason', p_reason,
      'expires_at', p_expires_at
    ),
    v_actor_id
  );

  RETURN v_override_id;
END;
$$;


-- ============================================
-- Function: delete_feature_override
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION delete_feature_override(
  p_tenant_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
  v_old_value JSONB;
BEGIN
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Buscar override existente
  SELECT id, json_build_object(
    'feature_key', feature_key,
    'is_enabled', is_enabled,
    'reason', reason,
    'expires_at', expires_at
  )::jsonb
  INTO v_override_id, v_old_value
  FROM tenant_feature_overrides
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature_key;

  IF v_override_id IS NULL THEN
    RETURN false;
  END IF;

  -- Deletar override
  DELETE FROM tenant_feature_overrides
  WHERE id = v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, old_value, changed_by
  ) VALUES (
    p_tenant_id, 'feature', v_override_id, 'deleted', v_old_value, v_actor_id
  );

  RETURN true;
END;
$$;


-- ============================================
-- Function: delete_limit_override
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION delete_limit_override(
  p_tenant_id UUID,
  p_limit_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
  v_old_value JSONB;
BEGIN
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Buscar override existente
  SELECT id, json_build_object(
    'limit_key', limit_key,
    'custom_value', custom_value,
    'reason', reason,
    'expires_at', expires_at
  )::jsonb
  INTO v_override_id, v_old_value
  FROM tenant_limit_overrides
  WHERE tenant_id = p_tenant_id AND limit_key = p_limit_key;

  IF v_override_id IS NULL THEN
    RETURN false;
  END IF;

  -- Deletar override
  DELETE FROM tenant_limit_overrides
  WHERE id = v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, old_value, changed_by
  ) VALUES (
    p_tenant_id, 'limit', v_override_id, 'deleted', v_old_value, v_actor_id
  );

  RETURN true;
END;
$$;


-- ============================================
-- Function: get_all_overrides
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_all_overrides(
  p_tenant_id UUID DEFAULT NULL,
  p_include_expired BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'features', COALESCE((
      SELECT json_agg(json_build_object(
        'id', fo.id,
        'tenant_id', fo.tenant_id,
        'tenant_name', t.name,
        'feature_key', fo.feature_key,
        'is_enabled', fo.is_enabled,
        'reason', fo.reason,
        'enabled_by', fo.enabled_by,
        'enabled_by_name', p.full_name,
        'expires_at', fo.expires_at,
        'created_at', fo.created_at,
        'is_expired', fo.expires_at IS NOT NULL AND fo.expires_at <= now()
      ) ORDER BY fo.created_at DESC)
      FROM tenant_feature_overrides fo
      LEFT JOIN tenants t ON t.id = fo.tenant_id
      LEFT JOIN profiles p ON p.id = fo.enabled_by
      WHERE (p_tenant_id IS NULL OR fo.tenant_id = p_tenant_id)
        AND (p_include_expired OR fo.expires_at IS NULL OR fo.expires_at > now())
    ), '[]'::json),
    'limits', COALESCE((
      SELECT json_agg(json_build_object(
        'id', lo.id,
        'tenant_id', lo.tenant_id,
        'tenant_name', t.name,
        'limit_key', lo.limit_key,
        'custom_value', lo.custom_value,
        'reason', lo.reason,
        'enabled_by', lo.enabled_by,
        'enabled_by_name', p.full_name,
        'expires_at', lo.expires_at,
        'created_at', lo.created_at,
        'is_expired', lo.expires_at IS NOT NULL AND lo.expires_at <= now()
      ) ORDER BY lo.created_at DESC)
      FROM tenant_limit_overrides lo
      LEFT JOIN tenants t ON t.id = lo.tenant_id
      LEFT JOIN profiles p ON p.id = lo.enabled_by
      WHERE (p_tenant_id IS NULL OR lo.tenant_id = p_tenant_id)
        AND (p_include_expired OR lo.expires_at IS NULL OR lo.expires_at > now())
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: get_my_tenant_id
-- Source: 20260330450000_fix_missing_helper_functions.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_tenant_id(auth.uid());
$$;


-- ============================================
-- Function: get_my_profile_id
-- Source: 20260330450000_fix_missing_helper_functions.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid();
$$;


-- ============================================
-- Function: handle_new_tenant_chat_channel
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_tenant_chat_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (tenant_id, name, description, is_default)
  VALUES (NEW.id, 'Geral', 'Canal geral da equipe', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: guard_user_roles_admin_promotion
-- Source: 20260704300000_fix_guard_user_roles_allow_auth_trigger.sql
-- ============================================
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

