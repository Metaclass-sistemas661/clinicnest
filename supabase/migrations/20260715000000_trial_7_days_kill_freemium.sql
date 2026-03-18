-- ============================================================================
-- Migration: Trial 7 dias + Extermínio do Freemium
-- ============================================================================
-- 1. Altera o default de trial_end de 5 para 7 dias
-- 2. Atualiza subscriptions 'trialing' existentes de 5→7 dias
-- 3. Converte qualquer subscription plan='free' para 'trialing' com trial de 7 dias
-- 4. Atualiza handle_new_user() para usar trial_end = 7 dias explicitamente
-- ============================================================================

-- 1. Alterar o default da coluna trial_end para 7 dias
ALTER TABLE public.subscriptions
  ALTER COLUMN trial_end SET DEFAULT (now() + INTERVAL '7 days');

-- 2. Atualizar trials existentes que ainda usam 5 dias (expandir para 7)
UPDATE public.subscriptions
SET trial_end = trial_start + INTERVAL '7 days'
WHERE status = 'trialing'
  AND trial_end IS NOT NULL
  AND trial_start IS NOT NULL
  AND trial_end <= (trial_start + INTERVAL '5 days' + INTERVAL '1 minute');

-- 3. Converter qualquer plano "free" para trialing com trial de 7 dias
UPDATE public.subscriptions
SET status = 'trialing',
    plan = NULL,
    trial_start = COALESCE(trial_start, now()),
    trial_end = COALESCE(trial_start, now()) + INTERVAL '7 days'
WHERE plan = 'free'
  AND status IN ('active', 'trialing');

-- 4. Atualizar trigger handle_new_user() para usar 7 dias explicitamente
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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger auth.users AFTER INSERT — provisiona perfil e tenant.
   
   PATH 1 (admin_invite): Adiciona usuário a tenant existente com role staff/admin.
   PATH 2 (signup normal): Cria tenant + profile admin + subscription trialing 7 dias.
   
   v4 — 7-Day Trial (sem freemium):
   • Trial de 7 dias com acesso total (Premium)
   • Sem plano free — após trial, deve assinar
   • Guard de idempotência (ON CONFLICT + IF EXISTS)
   • Validação segura de UUID no admin_invite
   • EXCEPTION handler para unique_violation e erros genéricos
   • RAISE LOG em cada path para auditoria';
