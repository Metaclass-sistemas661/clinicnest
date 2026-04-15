-- ============================================================
-- ClinicaFlow GCP Migration: Funções Helper
-- Cloud SQL PostgreSQL 15+
-- Adaptado: auth.uid() → current_setting('app.current_user_id')
-- ============================================================

-- Trigger genérico para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: obter current_user_id da sessão
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- Helper: obter tenant_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Helper: verificar acesso ao tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    );
$$;

-- Helper: verificar se é admin do tenant
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

-- Helper: verificar role
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

-- Helper: tenant tem feature (subscription gating)
CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.tenant_id = p_tenant_id
          AND s.status IN ('active', 'trialing')
    );
$$;

-- Helper: obter tenant_id do usuário da sessão atual
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT public.get_user_tenant_id(public.current_user_id());
$$;
