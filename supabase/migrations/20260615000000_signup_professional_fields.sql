-- ============================================================================
-- Migration: Suporte a profissão e conselho no cadastro (signup normal)
-- ============================================================================
-- Atualiza o trigger handle_new_user() para ler professional_type, council_type,
-- council_number e council_state dos user_metadata no signup normal (caso 3).
-- Anteriormente esses campos só eram lidos no admin_invite (caso 2).
-- O usuário continua sendo admin (user_roles.role = 'admin'), mas agora o
-- profile.professional_type reflete a profissão real (ex: 'medico' em vez de 'admin').

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_full_name TEXT;
  v_clinic_name TEXT;
  v_email TEXT;
  v_invite_tenant_id TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_prof_type TEXT;
  v_council_type TEXT;
  v_council_number TEXT;
  v_council_state TEXT;
BEGIN
  -- 1) Usuários convidados pelo admin: adicionar ao tenant existente como staff/admin
  IF (NEW.raw_user_meta_data->>'source') = 'admin_invite' THEN
    v_invite_tenant_id := NEW.raw_user_meta_data->>'tenant_id';
    IF v_invite_tenant_id IS NULL OR v_invite_tenant_id = '' THEN
      RAISE EXCEPTION 'admin_invite: tenant_id obrigatório em user_metadata';
    END IF;

    v_tenant_id := v_invite_tenant_id::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
      RAISE EXCEPTION 'admin_invite: tenant_id inválido ou inexistente';
    END IF;

    v_full_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
      'Profissional'
    );
    v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
    v_role := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'staff');

    IF v_role NOT IN ('admin', 'staff') THEN
      v_role := 'staff';
    END IF;

    v_prof_type := NULLIF(TRIM(NEW.raw_user_meta_data->>'professional_type'), '');
    v_council_type := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_type'), '');
    v_council_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_number'), '');
    v_council_state := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_state'), '');

    INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, professional_type, council_type, council_number, council_state)
    VALUES (
      NEW.id,
      v_tenant_id,
      v_full_name,
      NEW.email,
      v_phone,
      COALESCE(v_prof_type, 'secretaria')::public.professional_type,
      v_council_type,
      v_council_number,
      v_council_state
    );

    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, v_tenant_id, v_role::public.app_role);

    RETURN NEW;
  END IF;

  -- 3) Cadastro gratuito (signup normal): criar novo tenant + profile admin + subscription
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
    'Usuário'
  );
  
  -- Suporta tanto clinic_name (novo) quanto salon_name (legado) para compatibilidade
  v_clinic_name := COALESCE(
    NEW.raw_user_meta_data->>'clinic_name',
    NEW.raw_user_meta_data->>'salon_name',
    'Clínica ' || v_full_name,
    'Minha Clínica'
  );
  v_email := NEW.email;

  -- Ler dados profissionais dos metadata (novidade: antes era hardcoded 'admin')
  v_prof_type := NULLIF(TRIM(NEW.raw_user_meta_data->>'professional_type'), '');
  v_council_type := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_type'), '');
  v_council_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_number'), '');
  v_council_state := NULLIF(TRIM(NEW.raw_user_meta_data->>'council_state'), '');

  INSERT INTO public.tenants (name, email)
  VALUES (v_clinic_name, v_email)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (
    user_id, tenant_id, full_name, email,
    professional_type, council_type, council_number, council_state
  )
  VALUES (
    NEW.id,
    v_tenant_id,
    v_full_name,
    v_email,
    COALESCE(v_prof_type, 'admin')::public.professional_type,
    v_council_type,
    v_council_number,
    v_council_state
  );

  -- Role é sempre admin para o criador do tenant
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role);

  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (v_tenant_id, 'trialing');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger para criação de novos usuários. Suporta:
   1. Usuários criados via Stripe (webhook separado)
   2. Usuários convidados por admin (admin_invite)
   3. Cadastro gratuito (cria tenant + profile + subscription)
   
   Atualizado para ler professional_type, council_type, council_number e 
   council_state dos user_metadata no signup normal. O role continua sendo 
   admin para o criador do tenant, mas professional_type agora reflete a 
   profissão real do profissional.';
