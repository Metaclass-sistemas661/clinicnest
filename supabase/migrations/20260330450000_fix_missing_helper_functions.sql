-- Migration: Fix missing helper functions
-- Cria funções auxiliares que estavam faltando

-- 1. Função get_my_tenant_id() - wrapper para get_user_tenant_id(auth.uid())
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_tenant_id(auth.uid());
$$;

COMMENT ON FUNCTION public.get_my_tenant_id() IS 'Retorna o tenant_id do usuário autenticado atual';

-- 2. Função get_my_profile_id() - retorna o profile_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_my_profile_id() IS 'Retorna o profile_id (UUID) do usuário autenticado atual';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
