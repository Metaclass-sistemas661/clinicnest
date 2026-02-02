-- Trigger para garantir que todo novo usuário (cadastro gratuito) seja criado como ADMIN
-- Ignora usuários criados pelo Stripe webhook (source='stripe')

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
BEGIN
  -- Ignorar usuários criados pelo Stripe (webhook cria tenant/profile/role separadamente)
  IF (NEW.raw_user_meta_data->>'source') = 'stripe' THEN
    RETURN NEW;
  END IF;

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

  -- 1. Criar tenant
  INSERT INTO public.tenants (name, email)
  VALUES (v_salon_name, v_email)
  RETURNING id INTO v_tenant_id;

  -- 2. Criar profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name, email)
  VALUES (NEW.id, v_tenant_id, v_full_name, v_email);

  -- 3. Criar user_roles como ADMIN (sempre admin no cadastro gratuito)
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin'::public.app_role);

  -- 4. Criar subscription (período de teste)
  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (v_tenant_id, 'trialing');

  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver (evitar duplicata)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
