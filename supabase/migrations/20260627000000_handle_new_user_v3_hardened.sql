-- ============================================================================
-- Migration: handle_new_user v3 — Versão hardened
-- ============================================================================
-- Corrige e endurecece a trigger handle_new_user():
--   1. Remove fallback legado salon_name (código morto)
--   2. Guard de idempotência (ON CONFLICT / IF NOT EXISTS)
--   3. Validação segura de UUID no admin_invite
--   4. Leitura de phone no signup normal
--   5. EXCEPTION handler com mensagens claras
--   6. RAISE LOG para auditoria em cada path
--   7. Comment atualizado sem referência a Stripe
-- ============================================================================

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
  -- ──────────────────────────────────────────────────────────────────────────
  -- PATH 1: Admin invite — adiciona ao tenant existente como staff/admin
  -- ──────────────────────────────────────────────────────────────────────────
  IF (NEW.raw_user_meta_data->>'source') = 'admin_invite' THEN
    v_invite_tid := NULLIF(TRIM(NEW.raw_user_meta_data->>'tenant_id'), '');

    IF v_invite_tid IS NULL THEN
      RAISE EXCEPTION 'admin_invite: tenant_id obrigatório em user_metadata'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Validação segura do UUID (evita erro genérico de cast)
    BEGIN
      v_tenant_id := v_invite_tid::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'admin_invite: tenant_id "%" não é um UUID válido', v_invite_tid
        USING ERRCODE = 'invalid_parameter_value';
    END;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
      RAISE EXCEPTION 'admin_invite: tenant_id % não encontrado', v_tenant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Guard de idempotência: se o profile já existe, não duplicar
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
      RAISE LOG 'handle_new_user: profile já existe para user_id=%, ignorando admin_invite duplicado', NEW.id;
      RETURN NEW;
    END IF;

    v_full_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
      'Profissional'
    );
    v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
    v_role  := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'staff');

    IF v_role NOT IN ('admin', 'staff') THEN
      v_role := 'staff';
    END IF;

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
  -- PATH 2: Signup normal — cria tenant + profile admin + subscription trial
  -- ──────────────────────────────────────────────────────────────────────────

  -- Guard de idempotência: se o profile já existe, não duplicar
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

  -- Dados profissionais do wizard de cadastro
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

  -- Role é sempre admin para quem cria o tenant
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (v_tenant_id, 'trialing')
  ON CONFLICT (tenant_id) DO NOTHING;

  RAISE LOG 'handle_new_user[signup]: user=% tenant=% clinic=%', NEW.id, v_tenant_id, v_clinic_name;
  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
    -- Idempotência: se houve race condition, loga e segue
    RAISE LOG 'handle_new_user: unique_violation para user_id=%, provável duplicata — ignorando', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: erro inesperado para user_id=% — SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
    RAISE;
END;
$$;

-- ============================================================================
-- Comment atualizado (sem referência a Stripe)
-- ============================================================================
COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger auth.users AFTER INSERT — provisiona perfil e tenant.
   
   PATH 1 (admin_invite): Adiciona usuário a tenant existente com role staff/admin.
   PATH 2 (signup normal): Cria tenant + profile admin + subscription trialing.
   
   v3 — Hardened:
   • Guard de idempotência (ON CONFLICT + IF EXISTS)
   • Validação segura de UUID no admin_invite
   • Leitura de phone no signup normal
   • EXCEPTION handler para unique_violation e erros genéricos
   • RAISE LOG em cada path para auditoria
   • Removido fallback legado salon_name
   • Removido guard morto source=stripe';
