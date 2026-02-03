-- Estende handle_new_user para usuários convidados pelo admin (source='admin_invite').
-- Nesse caso: NÃO cria tenant nem subscription; apenas profile + user_roles no tenant existente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_full_name TEXT;
  v_salon_name TEXT;
  v_email TEXT;
  v_invite_tenant_id TEXT;
  v_phone TEXT;
  v_role TEXT;
BEGIN
  -- 1) Usuários criados pelo Stripe: webhook cria tenant/profile/role separadamente
  IF (NEW.raw_user_meta_data->>'source') = 'stripe' THEN
    RETURN NEW;
  END IF;

  -- 2) Usuários convidados pelo admin: adicionar ao tenant existente como staff/admin
  IF (NEW.raw_user_meta_data->>'source') = 'admin_invite' THEN
    v_invite_tenant_id := NEW.raw_user_meta_data->>'tenant_id';
    IF v_invite_tenant_id IS NULL OR v_invite_tenant_id = '' THEN
      RAISE EXCEPTION 'admin_invite: tenant_id obrigatório em user_metadata';
    END IF;

    v_tenant_id := v_invite_tenant_id::UUID;

    -- Garantir que o tenant existe
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

    -- Profile no mesmo tenant
    INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone)
    VALUES (NEW.id, v_tenant_id, v_full_name, NEW.email, v_phone);

    -- Role (staff ou admin) no mesmo tenant
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
  v_salon_name := COALESCE(
    NEW.raw_user_meta_data->>'salon_name',
    'Salão ' || v_full_name,
    'Meu Salão'
  );
  v_email := NEW.email;

  INSERT INTO public.tenants (name, email)
  VALUES (v_salon_name, v_email)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, email)
  VALUES (NEW.id, v_tenant_id, v_full_name, v_email);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role);

  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (v_tenant_id, 'trialing');

  RETURN NEW;
END;
$$;
