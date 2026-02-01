-- BeautySalon SaaS Multi-Tenant Database Schema
-- Following security architecture recommendations

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- 2. Create tenants table (salons)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create profiles table (users linked to tenants)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- 5. Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create services table
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- 9. Create appointments table
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status appointment_status NOT NULL DEFAULT 'pending',
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create financial transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- 11. Create financial_transactions table
CREATE TABLE public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Create stock_movements table for inventory tracking
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Security helper functions (SECURITY DEFINER to avoid RLS recursion)

-- Get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Check if user has access to tenant
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

-- Check if user has specific role in tenant
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

-- Check if user is admin in their tenant
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

-- 16. Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 17. RLS Policies for tenants
CREATE POLICY "Users can view their own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can update their tenant"
ON public.tenants FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), id))
WITH CHECK (public.is_tenant_admin(auth.uid(), id));

-- 18. RLS Policies for profiles
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles in their tenant"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete profiles in their tenant"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) AND user_id != auth.uid());

-- 19. RLS Policies for user_roles
CREATE POLICY "Users can view roles in their tenant"
ON public.user_roles FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage roles in their tenant"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- 20. RLS Policies for clients
CREATE POLICY "Users can view clients in their tenant"
ON public.clients FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create clients in their tenant"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update clients in their tenant"
ON public.clients FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete clients in their tenant"
ON public.clients FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 21. RLS Policies for services
CREATE POLICY "Users can view services in their tenant"
ON public.services FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create services in their tenant"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update services in their tenant"
ON public.services FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete services in their tenant"
ON public.services FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 22. RLS Policies for products (Admin only for write operations)
CREATE POLICY "Users can view products in their tenant"
ON public.products FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can create products in their tenant"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update products in their tenant"
ON public.products FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete products in their tenant"
ON public.products FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 23. RLS Policies for appointments
CREATE POLICY "Users can view appointments in their tenant"
ON public.appointments FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create appointments in their tenant"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update appointments in their tenant"
ON public.appointments FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete appointments in their tenant"
ON public.appointments FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 24. RLS Policies for financial_transactions (Admin only)
CREATE POLICY "Admins can view financials in their tenant"
ON public.financial_transactions FOR SELECT
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can create financials in their tenant"
ON public.financial_transactions FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update financials in their tenant"
ON public.financial_transactions FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete financials in their tenant"
ON public.financial_transactions FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 25. RLS Policies for stock_movements
CREATE POLICY "Users can view stock movements in their tenant"
ON public.stock_movements FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create stock movements in their tenant"
ON public.stock_movements FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- 26. Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX idx_services_tenant_id ON public.services(tenant_id);
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_financial_transactions_tenant_id ON public.financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_stock_movements_tenant_id ON public.stock_movements(tenant_id);
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);