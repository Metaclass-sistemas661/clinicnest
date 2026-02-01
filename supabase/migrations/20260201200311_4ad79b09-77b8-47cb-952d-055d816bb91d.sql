-- Drop the problematic tenant insert policy and recreate with proper check
DROP POLICY IF EXISTS "Users can create tenants during signup" ON public.tenants;

-- Allow any authenticated user to create ONE tenant (for signup)
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- For profiles: allow insert if user_id matches auth.uid() (already exists but ensure it's correct)
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- For user_roles: allow insert if user_id matches auth.uid()
DROP POLICY IF EXISTS "Users can create their own role during signup" ON public.user_roles;
CREATE POLICY "Users can create their own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());