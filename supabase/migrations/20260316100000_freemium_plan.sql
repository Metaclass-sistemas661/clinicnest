-- ═══════════════════════════════════════════════════════════════════════════════
-- FASE 4A — Plano Freemium Permanente
--
-- 1. Atualiza handle_new_user para criar subscription como 'active' + plan 'free'
-- 2. Converte trials expirados (sem pagamento) para plano free
-- 3. Garante que plano free nunca expire
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Atualizar trigger handle_new_user ─────────────────────────────────────
-- Novos cadastros começam direto no plano free (ativo, sem trial, sem expiração)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_tenant_id  uuid;
  v_full_name  text;
  v_email      text;
  v_clinic_name text;
  v_phone      text;
  v_source     text;
  v_invite_tenant_id uuid;
  v_invite_role      text;
  v_professional_type text;
  v_council_type     text;
  v_council_number   text;
  v_council_state    text;
BEGIN
  v_full_name   := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_email       := COALESCE(NEW.email, '');
  v_phone       := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'Minha Clínica');
  v_source      := COALESCE(NEW.raw_user_meta_data->>'source', 'self_signup');
  v_professional_type := COALESCE(NEW.raw_user_meta_data->>'professional_type', 'admin');
  v_council_type     := NEW.raw_user_meta_data->>'council_type';
  v_council_number   := NEW.raw_user_meta_data->>'council_number';
  v_council_state    := NEW.raw_user_meta_data->>'council_state';

  -- ── Invite flow: admin invited this user ──
  IF v_source = 'admin_invite' THEN
    v_invite_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
    v_invite_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'staff');

    IF v_invite_tenant_id IS NULL THEN
      RAISE EXCEPTION 'admin_invite requires tenant_id in metadata';
    END IF;

    INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, professional_type, council_type, council_number, council_state)
    VALUES (NEW.id, v_invite_tenant_id, v_full_name, v_email, v_phone,
            v_professional_type::public.professional_type,
            v_council_type, v_council_number, v_council_state);

    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, v_invite_tenant_id, v_invite_role::public.app_role);

    RETURN NEW;
  END IF;

  -- ── Self-signup flow ──
  INSERT INTO public.tenants (name, email)
  VALUES (v_clinic_name, v_email)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, professional_type, council_type, council_number, council_state)
  VALUES (NEW.id, v_tenant_id, v_full_name, v_email, v_phone,
          v_professional_type::public.professional_type,
          v_council_type, v_council_number, v_council_state);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role);

  -- Plano FREE permanente (em vez de trial que expira)
  INSERT INTO public.subscriptions (tenant_id, status, plan)
  VALUES (v_tenant_id, 'active', 'free');

  RETURN NEW;
END;
$$;

-- ─── 2. Converter trials expirados para free ──────────────────────────────────
UPDATE public.subscriptions
SET status = 'active',
    plan = 'free'
WHERE status = 'trialing'
  AND trial_end IS NOT NULL
  AND trial_end < NOW()
  AND (plan IS NULL OR plan = '');

-- ─── 3. Garantir que subscriptions sem plano definido tenham 'free' ───────────
UPDATE public.subscriptions
SET plan = 'free'
WHERE plan IS NULL OR plan = '';

COMMENT ON FUNCTION public.handle_new_user() IS 
'Trigger on auth.users INSERT. Creates tenant, profile, user_roles and free subscription for self-signup. For admin_invite, only creates profile and role in existing tenant. Updated Fase 4A: new users start on free plan (active) instead of trial.';
