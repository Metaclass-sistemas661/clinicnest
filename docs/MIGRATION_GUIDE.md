# Guia de Migração - ProBeleza

Este documento contém todas as instruções para migrar o ProBeleza do Lovable Cloud para um Supabase externo.

## 📋 Informações do Projeto Externo

- **URL:** `https://SEU_PROJECT_REF.supabase.co`
- **Anon Key:** (obtenha no Supabase Dashboard → Settings → API)

---

## 🗄️ Passo 1: Criar Estrutura do Banco de Dados

Execute os seguintes SQLs no **SQL Editor** do seu Supabase externo (https://supabase.com/dashboard/project/pijjuhtyxcidqceukogv/sql):

### 1.1 Criar Tipos (Enums)

```sql
-- Criar enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
```

### 1.2 Criar Tabelas

```sql
-- Tabela de tenants (salões)
CREATE TABLE public.tenants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de perfis
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de clientes
CREATE TABLE public.clients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de serviços
CREATE TABLE public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cost NUMERIC NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de agendamentos
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status public.appointment_status NOT NULL DEFAULT 'pending',
    price NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras
CREATE TABLE public.financial_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type public.transaction_type NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações de estoque
CREATE TABLE public.stock_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 1.3 Habilitar RLS em todas as tabelas

```sql
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
```

---

## 🔧 Passo 2: Criar Funções Auxiliares

```sql
-- Função para obter tenant_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Função para verificar acesso ao tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    );
$$;

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = p_role
    );
$$;

-- Função para verificar se é admin do tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND role = 'admin'
    );
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Função para criar receita quando agendamento é concluído
CREATE OR REPLACE FUNCTION public.create_income_on_appointment_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.price > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.financial_transactions 
            WHERE appointment_id = NEW.id
        ) THEN
            INSERT INTO public.financial_transactions (
                tenant_id, appointment_id, type, category, amount, description, transaction_date
            ) VALUES (
                NEW.tenant_id, NEW.id, 'income', 'Serviço', NEW.price, 'Agendamento concluído', CURRENT_DATE
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
```

---

## 🔒 Passo 3: Criar Políticas RLS

```sql
-- ========== TENANTS ==========
CREATE POLICY "Allow authenticated users to insert tenants" ON public.tenants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to view their tenant" ON public.tenants
    FOR SELECT USING (
        (id = get_user_tenant_id(auth.uid())) OR 
        (NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()))
    );

CREATE POLICY "Admins can update their tenant" ON public.tenants
    FOR UPDATE USING (is_tenant_admin(auth.uid(), id))
    WITH CHECK (is_tenant_admin(auth.uid(), id));

-- ========== PROFILES ==========
CREATE POLICY "Users can create their own profile" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete profiles in their tenant" ON public.profiles
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id) AND user_id <> auth.uid());

-- ========== USER_ROLES ==========
CREATE POLICY "Users can create their own role during signup" ON public.user_roles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view roles in their tenant" ON public.user_roles
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage roles in their tenant" ON public.user_roles
    FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id))
    WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- ========== CLIENTS ==========
CREATE POLICY "Users can view clients in their tenant" ON public.clients
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create clients in their tenant" ON public.clients
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update clients in their tenant" ON public.clients
    FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete clients in their tenant" ON public.clients
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id));

-- ========== SERVICES ==========
CREATE POLICY "Users can view services in their tenant" ON public.services
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create services in their tenant" ON public.services
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update services in their tenant" ON public.services
    FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete services in their tenant" ON public.services
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id));

-- ========== PRODUCTS ==========
CREATE POLICY "Users can view products in their tenant" ON public.products
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can create products in their tenant" ON public.products
    FOR INSERT WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update products in their tenant" ON public.products
    FOR UPDATE USING (is_tenant_admin(auth.uid(), tenant_id))
    WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete products in their tenant" ON public.products
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id));

-- ========== APPOINTMENTS ==========
CREATE POLICY "Users can view appointments in their tenant" ON public.appointments
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create appointments in their tenant" ON public.appointments
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update appointments in their tenant" ON public.appointments
    FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete appointments in their tenant" ON public.appointments
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id));

-- ========== FINANCIAL_TRANSACTIONS ==========
CREATE POLICY "Admins can view financials in their tenant" ON public.financial_transactions
    FOR SELECT USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can create financials in their tenant" ON public.financial_transactions
    FOR INSERT WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update financials in their tenant" ON public.financial_transactions
    FOR UPDATE USING (is_tenant_admin(auth.uid(), tenant_id))
    WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete financials in their tenant" ON public.financial_transactions
    FOR DELETE USING (is_tenant_admin(auth.uid(), tenant_id));

-- ========== STOCK_MOVEMENTS ==========
CREATE POLICY "Users can view stock movements in their tenant" ON public.stock_movements
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create stock movements in their tenant" ON public.stock_movements
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
```

---

## ⚡ Passo 4: Criar Triggers

```sql
-- Triggers para updated_at
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at
    BEFORE UPDATE ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar receita automática
CREATE TRIGGER create_income_on_completion
    AFTER UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.create_income_on_appointment_completion();
```

---

## 🔐 Passo 5: Configurar Autenticação

No painel do Supabase externo, vá em **Authentication > Providers** e configure:

1. **Email**: Habilite o provedor de email
2. **Site URL**: Configure para sua URL de produção (ex: `https://seudominio.com`)
3. **Redirect URLs**: Adicione URLs permitidas para redirecionamento

---

## 🚀 Passo 6: Deploy no Vercel/Netlify

### 6.1 Variáveis de Ambiente

Configure estas variáveis no seu serviço de hospedagem:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon/public key do Supabase Dashboard
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_REF
```

### 6.2 Build Settings (Vercel)

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 6.3 Build Settings (Netlify)

- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

---

## ✅ Checklist de Migração

- [ ] GitHub conectado ao projeto Lovable
- [ ] Projeto externo criado no Supabase
- [ ] Enums criados
- [ ] Tabelas criadas
- [ ] RLS habilitado em todas as tabelas
- [ ] Funções auxiliares criadas
- [ ] Políticas RLS criadas
- [ ] Triggers criados
- [ ] Autenticação configurada
- [ ] Variáveis de ambiente configuradas no hosting
- [ ] Deploy realizado
- [ ] Teste de cadastro/login funcionando
- [ ] Teste de CRUD funcionando

---

## ⚠️ Notas Importantes

1. **Dados**: Os dados do Lovable Cloud NÃO são migrados automaticamente. Se precisar migrar dados, exporte-os manualmente.

2. **Service Role Key**: A chave `service_role` é secreta e NUNCA deve ser exposta no frontend. Use apenas em edge functions ou backend.

3. **Após migração**: O projeto continuará funcionando no Lovable com o Cloud original. A versão externa é independente.

---

## 📞 Suporte

Se tiver dúvidas durante a migração, consulte:
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Netlify](https://docs.netlify.com)
