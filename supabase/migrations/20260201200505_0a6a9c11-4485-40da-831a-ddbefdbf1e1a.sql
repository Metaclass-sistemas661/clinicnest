-- First, drop all tenant policies and recreate them cleanly
DROP POLICY IF EXISTS "Admins can update their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

-- Disable and re-enable RLS to reset
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - allow any authenticated user to create
CREATE POLICY "Allow authenticated users to insert tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create SELECT policy - allow users to view their tenant OR tenants they just created
CREATE POLICY "Allow users to view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = get_user_tenant_id(auth.uid()) 
  OR NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid())
);

-- Create UPDATE policy - only admins can update
CREATE POLICY "Admins can update their tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), id))
WITH CHECK (is_tenant_admin(auth.uid(), id));